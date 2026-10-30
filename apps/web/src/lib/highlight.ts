// Tô màu phần khớp từ khóa trong kết quả tìm kiếm (ảnh 22): không phân biệt hoa thường và dấu
// ("bach" khớp "Bạch"), mỗi từ trong từ khóa được tô riêng.

export type Part = { text: string; match: boolean };

/** Một ký tự về dạng so sánh: bỏ dấu, hạ chữ thường. Luôn trả đúng 1 ký tự để giữ nguyên vị trí. */
function foldChar(c: string): string {
  const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
  return base.length === 1 ? base : c.toLowerCase().slice(0, 1) || c;
}

function fold(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) out += foldChar(s[i]);
  return out;
}

/** Cắt `text` thành các đoạn khớp / không khớp với các từ của `query`. */
export function highlight(text: string, query: string): Part[] {
  const words = [...new Set(fold(query).split(/\s+/).filter(Boolean))];
  if (words.length === 0 || !text) return [{ text, match: false }];

  const folded = fold(text);
  const hit = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    for (let at = folded.indexOf(word); at !== -1; at = folded.indexOf(word, at + word.length)) {
      for (let i = at; i < at + word.length; i++) hit[i] = true;
    }
  }

  const parts: Part[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.match === hit[i]) last.text += text[i];
    else parts.push({ text: text[i], match: hit[i] });
  }
  return parts;
}
