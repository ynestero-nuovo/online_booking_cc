/**
 * Метадані персоналу за реальним `doctor_id` Cliniccards: роль і фото.
 * (API ці поля не віддає — тримаємо тут.) Фото лежать у `public/specialists/`.
 */
export interface StaffMeta {
  role: string;
  photoUrl: string;
}

export const STAFF_BY_DOCTOR_ID: Record<string, StaffMeta> = {
  "79215": { role: "Головний лікар", photoUrl: "/specialists/kovbasa.png" },
  "79264": { role: "Лікар", photoUrl: "/specialists/samoukova.png" },
  "79716": { role: "Лікар", photoUrl: "/specialists/kashytska.png" },
  "94758": { role: "Лікар", photoUrl: "/specialists/movchan.png" },
  "88387": { role: "Косметолог", photoUrl: "/specialists/kalashnik.png" },
};
