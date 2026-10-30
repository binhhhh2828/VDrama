"""Xử lý ảnh poster: admin up một ảnh, hệ thống ra ba bản 3:4 (thumb, detail, hero) dạng WebP.

Kế hoạch và các quyết định: docs/plans/gd4-poster-images.md. Các bước, theo thứ tự:

1. Kiểm tra: giải mã thật (không tin đuôi file), chỉ JPEG/PNG/WebP, giới hạn dung lượng và điểm ảnh.
2. Cắt viền thừa (nền đen/đồng màu hoặc nền nhòe) bằng độ "chi tiết" của từng cột/hàng sát mép.
3. Đưa tranh về 3:4: gần 3:4 thì cắt vừa khung; hẹp hơn thì đặt nguyên vẹn vào giữa với hai bên là
   chính ảnh phóng to, làm nhòe và tối (không cắt mất tên phim); rộng hơn thì cắt hai bên.
4. Thu về ba cỡ, lưu WebP, bỏ mọi metadata.

Hàm thuần, chỉ dùng Pillow; việc nặng chạy trong thread qua `process_poster_async`.
"""

import asyncio
import io
from dataclasses import dataclass

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError

# Tên bản -> (rộng, cao). Cả ba đều 3:4.
RENDITIONS: dict[str, tuple[int, int]] = {
    "thumb": (360, 480),
    "detail": (720, 960),
    "hero": (900, 1200),
}

MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 40_000_000
MIN_WIDTH, MIN_HEIGHT = 600, 800
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
WEBP_QUALITY = 82
# Bản hero không được phóng to quá chừng này so với tranh thật, vì phóng to hơn sẽ vỡ nét.
MAX_UPSCALE = 1.6

TARGET_RATIO = 3 / 4
# Trong khoảng này thì cắt vừa khung; ngoài khoảng thì đặt vào giữa (hẹp) hoặc cắt hai bên (rộng).
COVER_MIN_RATIO = 0.6
COVER_MAX_RATIO = 0.82

# Cắt viền: chỉ cắt khi vùng tranh còn lại đủ lớn và viền đủ dày; nền nhòe/đen có độ chi tiết ≈ 0.
_ANALYSIS_SIDE = 400
_EDGE_FLOOR = 1.5
_EDGE_RATIO = 0.2
_MIN_TRIM = 0.02  # bỏ qua viền mỏng hơn 2% (thường là nhiễu nén ảnh)
_MIN_KEEP_AREA = 0.25
_SNAP = 0.015  # viền mỏng hơn 1,5% sát mép thì coi như không có (tránh cắt cụt đáy tranh)


class PosterError(Exception):
    """Gốc của mọi lỗi ảnh poster; `message` là câu tiếng Việt hiện cho admin."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class PosterInvalid(PosterError):
    pass


class PosterTooLarge(PosterError):
    pass


class PosterTooSmall(PosterError):
    pass


@dataclass(frozen=True)
class PosterResult:
    files: dict[str, bytes]  # tên bản -> nội dung WebP
    trimmed: bool  # có cắt viền thừa hay không
    source_size: tuple[int, int]
    art_box: tuple[int, int, int, int]  # vùng tranh (trái, trên, phải, dưới) trong ảnh gốc


def _open(data: bytes) -> Image.Image:
    if len(data) > MAX_BYTES:
        raise PosterTooLarge("Ảnh quá lớn, tối đa 10 MB.")
    try:
        im = Image.open(io.BytesIO(data))
        if im.format not in ALLOWED_FORMATS:
            raise PosterInvalid("Chỉ nhận ảnh JPEG, PNG hoặc WebP.")
        if im.width * im.height > MAX_PIXELS:
            raise PosterTooLarge("Ảnh có quá nhiều điểm ảnh, vui lòng dùng ảnh nhỏ hơn.")
        im.load()
    except PosterError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise PosterInvalid("Không đọc được file này, hãy dùng ảnh JPEG, PNG hoặc WebP.") from exc
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        base = Image.new("RGBA", im.size, (20, 20, 20, 255))
        im = Image.alpha_composite(base, im)
    return im.convert("RGB")


def _profile(edges: Image.Image, axis: str) -> list[float]:
    """Độ chi tiết trung bình của từng cột (axis 'x') hoặc từng hàng (axis 'y')."""
    size = (edges.width, 1) if axis == "x" else (1, edges.height)
    return [float(v) for v in edges.resize(size, Image.Resampling.BOX).tobytes()]


def _span(profile: list[float]) -> tuple[int, int]:
    """Đoạn [đầu, cuối) có chi tiết; ngoài đoạn đó là viền phẳng/nhòe."""
    ordered = sorted(profile)
    typical = ordered[
        len(ordered) * 3 // 4
    ]  # phần tranh luôn chiếm đa số nên mức "điển hình" là của tranh
    threshold = max(_EDGE_FLOOR, typical * _EDGE_RATIO)
    inside = [i for i, v in enumerate(profile) if v >= threshold]
    if not inside:
        return 0, len(profile)
    return inside[0], inside[-1] + 1


def find_art_box(im: Image.Image) -> tuple[int, int, int, int]:
    """Vùng tranh thật (trái, trên, phải, dưới) trong tọa độ ảnh gốc; không chắc thì trả cả ảnh."""
    full = (0, 0, im.width, im.height)
    scale = min(1.0, _ANALYSIS_SIDE / max(im.size))
    small = im.convert("L").resize(
        (max(1, round(im.width * scale)), max(1, round(im.height * scale))),
        Image.Resampling.BOX,
    )
    edges = small.filter(ImageFilter.FIND_EDGES)
    # Bộ lọc cho giá trị sai ở hàng/cột ngoài cùng; xóa đi để không bị nhầm là có chi tiết.
    edges.paste(0, (0, 0, edges.width, 1))
    edges.paste(0, (0, edges.height - 1, edges.width, edges.height))
    edges.paste(0, (0, 0, 1, edges.height))
    edges.paste(0, (edges.width - 1, 0, edges.width, edges.height))
    left, top, right, bottom = 0, 0, small.width, small.height
    # Hai vòng vì cắt chiều này làm số liệu chiều kia chính xác hơn.
    for _ in range(2):
        region = edges.crop((left, top, right, bottom))
        x0, x1 = _span(_profile(region, "x"))
        left, right = left + x0, left + x1
        region = edges.crop((left, top, right, bottom))
        y0, y1 = _span(_profile(region, "y"))
        top, bottom = top + y0, top + y1

    # Hàng/cột ngoài cùng đã bị xóa ở trên; viền rất mỏng thường là gradient tối: coi như sát mép.
    sx, sy = max(1, round(small.width * _SNAP)), max(1, round(small.height * _SNAP))
    left = 0 if left <= sx else left
    top = 0 if top <= sy else top
    right = small.width if right >= small.width - sx else right
    bottom = small.height if bottom >= small.height - sy else bottom

    kept = (right - left) * (bottom - top) / (small.width * small.height)
    cut_w = 1 - (right - left) / small.width
    cut_h = 1 - (bottom - top) / small.height
    if kept < _MIN_KEEP_AREA or max(cut_w, cut_h) < _MIN_TRIM:
        return full
    # Lùi vào vài điểm ảnh để không lẫn điểm giáp ranh giữa tranh và viền.
    inset = 2
    box = (
        round(left / scale) + inset if left > 0 else 0,
        round(top / scale) + inset if top > 0 else 0,
        round(right / scale) - inset if right < small.width else im.width,
        round(bottom / scale) - inset if bottom < small.height else im.height,
    )
    return (max(0, box[0]), max(0, box[1]), min(im.width, box[2]), min(im.height, box[3]))


def _fit_frame(art: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Đưa tranh vào khung `size` (3:4) theo quy tắc ở đầu file."""
    fw, fh = size
    ratio = art.width / art.height
    if ratio < COVER_MIN_RATIO:
        # Nền: chính tranh phóng cho phủ kín khung, làm nhòe và tối; tranh nguyên vẹn đặt giữa.
        bg = ImageOps.fit(art, size, Image.Resampling.LANCZOS)
        bg = bg.filter(ImageFilter.GaussianBlur(radius=fw / 18))
        bg = ImageEnhance.Brightness(bg).enhance(0.5)
        w = round(fh * ratio)
        fg = art.resize((w, fh), Image.Resampling.LANCZOS)
        bg.paste(fg, ((fw - w) // 2, 0))
        return bg
    return ImageOps.fit(art, size, Image.Resampling.LANCZOS, centering=(0.5, 0.7))


def _upscale_needed(art: Image.Image) -> float:
    """Hệ số phóng to của bản hero so với tranh thật."""
    fw, fh = RENDITIONS["hero"]
    ratio = art.width / art.height
    if ratio < COVER_MIN_RATIO:
        return fh / art.height
    return max(fw / art.width, fh / art.height)


def process_poster(data: bytes) -> PosterResult:
    im = _open(data)
    if im.width < MIN_WIDTH or im.height < MIN_HEIGHT:
        raise PosterTooSmall(f"Ảnh quá nhỏ, tối thiểu {MIN_WIDTH}×{MIN_HEIGHT} điểm ảnh.")
    box = find_art_box(im)
    art = im.crop(box)
    if _upscale_needed(art) > MAX_UPSCALE:
        raise PosterTooSmall("Phần tranh trong ảnh quá nhỏ so với khung, hãy dùng ảnh lớn hơn.")

    files: dict[str, bytes] = {}
    for name, size in RENDITIONS.items():
        out = io.BytesIO()
        _fit_frame(art, size).save(out, "WEBP", quality=WEBP_QUALITY, method=4)
        files[name] = out.getvalue()
    return PosterResult(
        files=files,
        trimmed=box != (0, 0, im.width, im.height),
        source_size=im.size,
        art_box=box,
    )


async def process_poster_async(data: bytes) -> PosterResult:
    return await asyncio.to_thread(process_poster, data)
