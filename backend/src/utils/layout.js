// Đề xuất layout (bố cục) thủy sinh dựa trên kích thước & loại hồ.
// Rule-based đơn giản, kèm gợi ý cây/cá thật lấy từ thư viện.

const STYLES = {
  iwagumi: {
    name: 'Iwagumi',
    description:
      'Bố cục tối giản tập trung vào đá theo số lẻ (3, 5...), 1 viên chủ đạo (Oyaishi). Trồng thảm tiền cảnh, ít loại cây.',
    hardscape: ['Đá chủ đạo 1 viên lớn', 'Đá phụ 2–4 viên nhỏ hơn', 'Nền phân nâng phía sau'],
    accent: 'cyan',
  },
  nature: {
    name: 'Nature (Phong cảnh tự nhiên)',
    description:
      'Phong cách Amano: kết hợp lũa + đá tạo điểm nhấn, cây phân tầng tiền–trung–hậu cảnh tạo chiều sâu.',
    hardscape: ['Lũa làm khung chính', 'Vài viên đá chân lũa', 'Nền trộn dinh dưỡng + sỏi suối'],
    accent: 'green',
  },
  jungle: {
    name: 'Jungle (Rừng rậm)',
    description:
      'Cây mọc tự do, rậm rạp, ít cắt tỉa. Hợp người bận rộn, tạo cảm giác hoang dã đầy sức sống.',
    hardscape: ['Lũa lớn phủ rêu/dương xỉ', 'Nền công nghiệp giàu dinh dưỡng'],
    accent: 'green',
  },
  dutch: {
    name: 'Dutch (Hà Lan)',
    description:
      'Không dùng lũa/đá, tập trung vào các luống cây nhiều màu xếp tầng. Đòi hỏi CO2 và ánh sáng mạnh.',
    hardscape: ['Không dùng hardscape', 'Nền dinh dưỡng dày 6–8cm'],
    accent: 'purple',
  },
  reef: {
    name: 'Reef / Biotope biển',
    description:
      'Hồ nước mặn dùng đá sống (live rock) tạo hang hốc cho cá và san hô. Cần skimmer và dòng chảy mạnh.',
    hardscape: ['Đá sống (live rock)', 'Nền cát aragonite', 'Bố trí hang hốc cho cá ẩn nấp'],
    accent: 'pink',
  },
};

export function suggestLayout(tank, lib = {}, contents = {}) {
  const volume = tank.volume || 0;
  const { length = 0, height = 0 } = tank.dimensions || {};
  const ratio = height ? length / height : 2; // hồ càng dài/thấp càng hợp Iwagumi

  // Bám theo những gì người dùng đã nhập vào hồ
  const hardscape = contents.hardscape || [];
  const hasDriftwood = hardscape.some((h) => h.type === 'driftwood');
  const hasRock = hardscape.some((h) => h.type === 'rock');
  const plantCount = (contents.plants || []).length;

  let key;
  if (tank.type === 'saltwater') {
    key = 'reef';
  } else if (hasRock && !hasDriftwood) {
    key = 'iwagumi'; // chỉ có đá -> Iwagumi
  } else if (hasDriftwood) {
    key = plantCount >= 5 || volume > 200 ? 'jungle' : 'nature'; // có lũa -> Nature/Jungle
  } else if (volume <= 40) {
    key = 'iwagumi'; // hồ nano tối giản dễ kiểm soát
  } else if (ratio >= 2.2 && volume <= 120) {
    key = 'nature';
  } else if (volume > 200) {
    key = 'jungle';
  } else {
    key = 'nature';
  }

  const style = STYLES[key];

  // Quy tắc thả cá thô: ~1cm chiều dài cá / 1 lít nước
  const stockingCm = Math.max(0, Math.floor(volume * 0.8));

  const pickNames = (arr) => (arr || []).map((p) => p.name || p.commonName);

  // Tóm tắt những gì người dùng đã có trong hồ (để hiển thị "dựa trên dữ liệu của bạn")
  const yourContents = {
    plants: pickNames(contents.plants),
    hardscape: pickNames(contents.hardscape),
    livestock: pickNames(contents.livestock),
  };
  const usedYourData =
    yourContents.plants.length + yourContents.hardscape.length + yourContents.livestock.length > 0;

  return {
    // Preserve legacy labels (including Jungle/Reef), expose a supported scene key.
    styleKey: tank.style || (tank.shape === 'jar' ? 'balcony_jar' : ({ jungle: 'lowtech', reef: 'nature' }[key] || key)),
    style: style.name,
    accent: style.accent,
    description: style.description,
    usedYourData,
    yourContents,
    tankSummary: {
      volume,
      dimensions: tank.dimensions,
      type: tank.type,
    },
    hardscape: style.hardscape,
    plants: {
      foreground: pickNames(lib.foreground),
      midground: pickNames(lib.midground),
      background: pickNames(lib.background),
    },
    stocking: {
      maxFishLengthCm: stockingCm,
      tip: `Với ~${volume} lít, tổng chiều dài cá nên dưới ~${stockingCm}cm (quy tắc 1cm/lít). Ưu tiên cá hiền nuôi theo đàn.`,
      suggestedFish: pickNames(lib.fish),
    },
    tips: [
      'Đặt điểm nhấn (đá/lũa) lệch theo tỉ lệ vàng (~1/3 chiều ngang), tránh đặt chính giữa.',
      'Tạo chiều sâu: vật liệu cao ở sau, thấp dần ra trước.',
      key === 'dutch' || key === 'jungle'
        ? 'Cần CO2 + đèn mạnh để cây lên màu và phát triển tốt.'
        : 'Cycle vi sinh 3–4 tuần trước khi thả cá để hệ ổn định.',
    ],
  };
}

// Dựng prompt (tiếng Anh, image model cho kết quả tốt hơn) mô tả hồ
// dựa trên dữ liệu người dùng đã nhập + style + ghi chú mong muốn.
export function buildImagePrompt(tank, contents = {}, opts = {}) {
  const { length = 0, width = 0, height = 0 } = tank.dimensions || {};
  const typeMap = {
    planted: 'planted freshwater',
    freshwater: 'community freshwater',
    saltwater: 'saltwater reef',
  };

  const join = (arr, fb) =>
    arr && arr.length ? arr.map((x) => x.name || x.commonName).join(', ') : fb;

  const plants = join(contents.plants, 'lush aquatic plants');
  const hardscapeByType = (t) =>
    (contents.hardscape || []).filter((h) => h.type === t).map((h) => h.name);
  const driftwood = hardscapeByType('driftwood');
  const rocks = hardscapeByType('rock');
  const fish = join(contents.livestock, 'a small school of peaceful fish');

  const parts = [
    `A photorealistic front view of a beautifully aquascaped ${typeMap[tank.type] || 'planted'} aquarium`,
    `${length}x${width}x${height} cm (about ${tank.volume || 0} liters)`,
    opts.style ? `in ${opts.style} aquascaping style` : '',
    driftwood.length ? `with driftwood (${driftwood.join(', ')})` : '',
    rocks.length ? `with rocks (${rocks.join(', ')})` : '',
    `planted with ${plants}`,
    `${fish} swimming`,
    opts.notes ? `Additional request: ${opts.notes}` : '',
    'crystal clear water, professional aquascaping photography, soft natural lighting, sharp focus, high detail, realistic, 16:9 aspect ratio, no text, no watermark',
  ];

  return parts.filter(Boolean).join('. ');
}
