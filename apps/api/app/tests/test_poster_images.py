"""Bộ xử lý ảnh poster (docs/plans/gd4-poster-images.md): cắt viền, ra 3:4, từ chối ảnh xấu."""

import io
import random

import pytest
from PIL import Image, ImageFilter

from app.services import poster_images as pi


def noise(w: int, h: int, seed: int = 1) -> Image.Image:
    """Ảnh nhiễu: có rất nhiều chi tiết nên được coi là phần tranh."""
    rng = random.Random(seed)
    return Image.frombytes("RGB", (w, h), rng.randbytes(w * h * 3))


def png(im: Image.Image) -> bytes:
    out = io.BytesIO()
    im.save(out, "PNG")
    return out.getvalue()


def framed(art: Image.Image, canvas: tuple[int, int], pos: tuple[int, int], blurred=False) -> bytes:
    """Đặt tranh lên khung 2:3: nền đen hoặc nền nhòe của chính tranh."""
    if blurred:
        bg = art.resize(canvas).filter(ImageFilter.GaussianBlur(40))
    else:
        bg = Image.new("RGB", canvas, (0, 0, 0))
    bg.paste(art, pos)
    return png(bg)


def decode(data: bytes) -> Image.Image:
    im = Image.open(io.BytesIO(data))
    assert im.format == "WEBP"
    return im


def test_ra_ba_ban_dung_co_va_ti_le_3_4():
    result = pi.process_poster(png(noise(900, 1200)))
    assert set(result.files) == {"thumb", "detail", "hero"}
    for name, size in pi.RENDITIONS.items():
        assert decode(result.files[name]).size == size
        assert size[0] * 4 == size[1] * 3
    assert not result.trimmed


def test_cat_vien_den_hai_ben():
    art = noise(600, 1200)
    result = pi.process_poster(framed(art, (1024, 1536), (212, 0)))
    left, top, right, bottom = result.art_box
    assert result.trimmed
    assert abs(left - 212) <= 12 and abs(right - 812) <= 12
    assert top == 0 and bottom == 1536 or bottom >= 1200


def test_cat_vien_den_phia_duoi():
    art = noise(800, 900)
    result = pi.process_poster(framed(art, (1100, 1536), (150, 0)))
    left, top, right, bottom = result.art_box
    assert result.trimmed
    assert bottom <= 900 and top == 0
    assert left >= 140 and right <= 960


def test_dai_toi_mong_o_day_tranh_khong_bi_coi_la_vien():
    # Đáy tranh có dải gradient tối (phổ biến ở poster có chữ): dải mỏng dưới 7% thì giữ nguyên.
    art = noise(900, 1200)
    dark = Image.new("RGB", (900, 60), (6, 6, 8))
    art.paste(dark, (0, 1140))
    result = pi.process_poster(png(art))
    assert result.art_box == (0, 0, 900, 1200)
    assert not result.trimmed


def test_cat_vien_nhoe_cua_chinh_anh():
    art = noise(640, 1280, seed=3)
    result = pi.process_poster(framed(art, (1024, 1536), (192, 0), blurred=True))
    left, _, right, _ = result.art_box
    assert result.trimmed
    assert abs(left - 192) <= 14 and abs(right - 832) <= 14


def test_khong_cat_khi_khong_co_vien():
    result = pi.process_poster(png(noise(1024, 1536)))
    assert not result.trimmed
    assert result.art_box == (0, 0, 1024, 1536)


def test_tranh_hep_dat_giua_voi_hai_ben_toi():
    # Tranh 9:16 (hẹp hơn 0,6): đặt nguyên vẹn vào giữa khung 3:4, hai bên là nền nhòe tối.
    art = Image.new("RGB", (720, 1280), (255, 255, 255))
    out = decode(pi.process_poster(png(art)).files["detail"]).convert("RGB")
    assert out.getpixel((out.width // 2, out.height // 2)) == (255, 255, 255)
    edge = out.getpixel((2, out.height // 2))
    assert max(edge) < 200  # nền hai bên đã tối đi, không phải trắng như tranh


def test_tranh_gan_3_4_cat_vua_khung_khong_co_nen_nhoe():
    art = Image.new("RGB", (900, 1250), (255, 255, 255))
    out = decode(pi.process_poster(png(art)).files["detail"]).convert("RGB")
    assert out.getpixel((2, out.height // 2)) == (255, 255, 255)


def test_anh_qua_nho():
    with pytest.raises(pi.PosterTooSmall):
        pi.process_poster(png(noise(500, 700)))


def test_phan_tranh_qua_nho_so_voi_khung_hero():
    # Tranh thật chỉ 400×600 trong khung 700×900: phóng lên 900×1200 sẽ vỡ nét.
    art = noise(400, 600)
    with pytest.raises(pi.PosterTooSmall):
        pi.process_poster(framed(art, (700, 900), (150, 0)))


def test_khong_phai_anh():
    with pytest.raises(pi.PosterInvalid):
        pi.process_poster(b"day khong phai la anh " * 100)


def test_file_gia_duoi_jpg_van_bi_tu_choi():
    with pytest.raises(pi.PosterInvalid):
        pi.process_poster(b"<html><script>alert(1)</script></html>")


def test_dinh_dang_khong_duoc_phep():
    out = io.BytesIO()
    noise(700, 900).save(out, "GIF")
    with pytest.raises(pi.PosterInvalid):
        pi.process_poster(out.getvalue())


def test_file_qua_nang():
    with pytest.raises(pi.PosterTooLarge):
        pi.process_poster(b"0" * (pi.MAX_BYTES + 1))


def test_qua_nhieu_diem_anh():
    big = Image.new("L", (7000, 6000))  # 42 triệu điểm ảnh, nén PNG rất nhỏ
    with pytest.raises(pi.PosterTooLarge):
        pi.process_poster(png(big))


def test_ban_webp_khong_mang_metadata():
    im = noise(900, 1200)
    exif = Image.Exif()
    exif[0x010F] = "Nikon"
    out = io.BytesIO()
    im.save(out, "JPEG", exif=exif)
    for data in pi.process_poster(out.getvalue()).files.values():
        assert not decode(data).info.get("exif")


def test_anh_png_co_nen_trong_suot_khong_loi():
    im = noise(900, 1200).convert("RGBA")
    im.putalpha(128)
    assert pi.process_poster(png(im)).files["thumb"]


async def test_ban_bat_dong_bo_cho_cung_ket_qua():
    data = png(noise(900, 1200, seed=5))
    a = await pi.process_poster_async(data)
    assert a.files == pi.process_poster(data).files


def test_lenh_poster_build(tmp_path):
    from app.cli import main

    src = tmp_path / "poster.png"
    src.write_bytes(png(noise(900, 1200)))
    out = tmp_path / "ra"
    assert main(["poster-build", str(src), "--out", str(out)]) == 0
    assert sorted(p.name for p in out.iterdir()) == ["detail.webp", "hero.webp", "thumb.webp"]


def test_lenh_poster_build_bao_loi_khi_file_hong(tmp_path, capsys):
    from app.cli import main

    src = tmp_path / "hong.jpg"
    src.write_bytes(b"khong phai anh")
    assert main(["poster-build", str(src), "--out", str(tmp_path / "ra")]) == 1
    assert "Lỗi" in capsys.readouterr().err


def test_bao_cao_cach_dua_vao_khung():
    exact = pi.process_poster(png(noise(900, 1200)))
    assert exact.fit == "exact" and abs(exact.art_ratio - 0.75) < 0.01
    # 900x1250 (0,72): lệch hơn 3% nên bị cắt bớt một ít.
    assert pi.process_poster(png(noise(900, 1250))).fit == "cover"
    # 9:16: quá hẹp nên độn nền nhòe.
    assert pi.process_poster(png(noise(720, 1280))).fit == "blur"


def test_quy_cach_khuyen_nghi_la_3_4_va_du_lon():
    w, h = pi.RECOMMENDED_SIZE
    assert w * 4 == h * 3
    assert w >= pi.MIN_WIDTH and h >= pi.MIN_HEIGHT
    # Ảnh đúng quy cách ra đúng khung, không phóng to hero quá mức.
    assert pi.process_poster(png(noise(w, h))).fit == "exact"
