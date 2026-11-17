// Gọi Gemini API để sinh ảnh (image generation) qua REST.
// Node 18+ có sẵn fetch toàn cục nên không cần thư viện ngoài.

export const isGeminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

export async function generateImage(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const err = new Error('Chưa cấu hình GEMINI_API_KEY trong .env');
    err.statusCode = 503;
    throw err;
  }

  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });
  } catch (e) {
    const err = new Error(`Không gọi được Gemini: ${e.message}`);
    err.statusCode = 502;
    throw err;
  }

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Gemini trả lỗi ${res.status}: ${body.slice(0, 300)}`);
    err.statusCode = res.status === 400 || res.status === 403 ? 400 : 502;
    throw err;
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p) => p.inlineData || p.inline_data);
  const inline = imgPart?.inlineData || imgPart?.inline_data;

  if (!inline?.data) {
    const err = new Error('Gemini không trả về ảnh (có thể prompt bị từ chối)');
    err.statusCode = 502;
    throw err;
  }

  const mime = inline.mimeType || inline.mime_type || 'image/png';
  return { dataUrl: `data:${mime};base64,${inline.data}`, mime };
}
