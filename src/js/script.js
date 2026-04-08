import { initOtpApp } from "./otp/app.js";
import { initContactModal } from "./ui/contact-modal.js";
import { initOutlookModal } from "./ui/outlook-modal.js";
import { initPricingDetail } from "./ui/pricing-detail.js";
import { initMenu } from "./ui/menu.js";
import { initWelcomeModal } from "./ui/welcome-modal.js";
import { initPreferences } from "./ui/preferences.js";

initPreferences();
initOtpApp();
initContactModal();
initOutlookModal();
initPricingDetail();
initMenu();
initWelcomeModal();
