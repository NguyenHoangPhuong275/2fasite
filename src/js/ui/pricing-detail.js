const PRICING_PRODUCTS = {
  gpt: {
    title: "ChatGPT Plus",
    image: "./assets/images/chatgptlogo.png",
    cycle: "1 tháng",
    price: "89K",
    status: "Có sẵn",
    contactUrl: "https://zalo.me/g/hlstya673",
    features: [
      "TK ChatGPT Plus cấp dùng riêng: 89K/tháng",
      "TK ChatGPT Plus chính chủ: 180K/tháng",
      "Có thể gia hạn dùng tiếp",
      "BẢO HÀNH FULL-TIME",
    ],
  },
  gemini: {
    title: "Gemini AI Pro + 5TB Google One",
    image: "./assets/images/geminilogo.png",
    cycle: "5 tháng",
    price: "100K",
    status: "Có sẵn",
    contactUrl: "https://zalo.me/g/fqklod325",
    features: [
      "Gemini AI Pro + 5TB Google One ADD FAM chính chủ",
      "Giá từ 100K - 240K",
      "BẢO HÀNH FULL-TIME",
      "LƯU Ý: 5TB này được share cho 5 người nên dung lượng thực tế dùng khoảng 1TB.",
    ],
  },
  capcut: {
    title: "CapCut Pro Team",
    image: "./assets/images/capcutlogo.png",
    cycle: "1 tháng",
    price: "36K",
    status: "Có sẵn",
    contactUrl: "https://zalo.me/g/fqklod325",
    features: [
      "Tài khoản CapCut Pro Team",
      "BẢO HÀNH FULL",
      "Không đổi email/mật khẩu để giữ bảo hành",
    ],
  },
  grok: {
    title: "SuperGrok",
    image: "./assets/images/groklogo.png",
    cycle: "1 tháng",
    price: "150K",
    status: "Có sẵn",
    contactUrl: "https://zalo.me/g/hlstya673",
    features: [
      "TK cấp SuperGrok",
      "BẢO HÀNH FULL-TIME",
    ],
  },
  veo3: {
    title: "Veo 3 Ultra",
    image: "./assets/images/logoveo3.png",
    cycle: "1 tháng",
    price: "50K",
    status: "Có sẵn",
    contactUrl: "https://zalo.me/g/hlstya673",
    features: [
      "TK cấp Veo3 Ultra 25K Credit 50K/tháng",
      "LƯU Ý: Tài khoản này bảo hành 24H. Nếu ổn định dùng 1 tháng; nếu bị Google quét thì dùng tối đa 7-14 ngày, tối thiểu 5 ngày(+).",
    ],
  },
  kling: {
    title: "Kling Pro",
    image: "./assets/images/logokling.png",
    cycle: "1 tháng",
    price: "135K",
    status: "Có sẵn",
    contactUrl: "https://zalo.me/g/fqklod325",
    features: [
      "Kling Pro 1K-1K1 Credit, 135K/tháng",
      "BẢO HÀNH 24H",
    ],
  },
  antigravity: {
    title: "Antigravity Ultra",
    image: "./assets/images/logoantigravity.png",
    cycle: "1 tháng",
    price: "350K",
    status: "Có sẵn",
    contactUrl: "https://zalo.me/g/fqklod325",
    features: [
      "Antigravity Add Fam Ultra, 350K/tháng",
      "BẢO HÀNH FULL-TIME",
    ],
  },
};

function renderProductDetail(productKey, product, refs) {
  refs.title.textContent = product.title;
  refs.tagline.textContent = product.tagline || "";
  refs.image.src = product.image;
  refs.image.alt = product.title;
  refs.image.setAttribute("data-product", productKey);
  refs.brand.classList.toggle("is-kling", productKey === "kling");
  refs.cycle.textContent = product.cycle;
  refs.price.textContent = product.price;
  refs.status.textContent = product.status || "Có sẵn";
  refs.contact.href = product.contactUrl;

  while (refs.features.firstChild) {
    refs.features.removeChild(refs.features.firstChild);
  }

  for (const feature of product.features || []) {
    const li = document.createElement("li");
    li.textContent = feature;
    refs.features.appendChild(li);
  }
}

export function initPricingDetail() {
  const modal = document.getElementById("pricingDetailModal");
  const closeX = document.getElementById("pricingDetailCloseX");
  const closeBtn = document.getElementById("pricingDetailCloseBtn");
  const triggers = document.querySelectorAll(".pricing-readmore[data-product]");

  const refs = {
    brand: document.querySelector(".pricing-detail-brand"),
    title: document.getElementById("pricingDetailTitle"),
    tagline: document.getElementById("pricingDetailTagline"),
    image: document.getElementById("pricingDetailImage"),
    cycle: document.getElementById("pricingDetailCycle"),
    price: document.getElementById("pricingDetailPrice"),
    status: document.getElementById("pricingDetailStatus"),
    features: document.getElementById("pricingDetailFeatures"),
    contact: document.getElementById("pricingDetailContact"),
  };

  if (
    !modal ||
    !closeX ||
    !closeBtn ||
    !refs.brand ||
    !refs.title ||
    !refs.tagline ||
    !refs.image ||
    !refs.cycle ||
    !refs.price ||
    !refs.status ||
    !refs.features ||
    !refs.contact
  ) {
    return;
  }

  const closeModal = () => {
    modal.classList.remove("active");
  };

  const openModal = (productKey) => {
    const product = PRICING_PRODUCTS[productKey];
    if (!product) {
      return;
    }

    renderProductDetail(productKey, product, refs);
    modal.classList.add("active");
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      const key = trigger.getAttribute("data-product") || "";
      openModal(key);
    });
  });

  closeX.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("active")) {
      closeModal();
    }
  });
}
