// The built-in bot marks: line drawings on a 24 by 24 grid, drawn with a 1.7 stroke, round caps and joins, no fill.
export const MARK_STROKE = 1.7;

export const MARKS: Record<string, readonly string[]> = {
  junior: ["M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"],
  atlas: ["M4.5 18.5 12 5.5 19.5 18.5 Z"],
  ledger: ["M6 8h12M6 12h12M6 16h8"],
  quartermaster: ["M6 6h12v12H6Z"],
  scribe: ["M8 17 12 5.5 16 17M9.6 13h4.8"],
  nightwatch: ["M14.5 6.2a6.2 6.2 0 1 0 .2 11.6 4.6 4.6 0 1 1-.2-11.6z"],
  diamond: ["M12 4.5 19.5 12 12 19.5 4.5 12 Z"],
  waves: [
    "M4 9c1.6 0 1.6 2.4 3.2 2.4S8.8 9 10.4 9 12 11.4 13.6 11.4 15.2 9 16.8 9 18.4 11.4 20 11.4M4 14.2c1.6 0 1.6 2.4 3.2 2.4S8.8 14.2 10.4 14.2s1.6 2.4 3.2 2.4 1.6-2.4 3.2-2.4 1.6 2.4 3.2 2.4",
  ],
};

export const MARK_IDS = Object.keys(MARKS);

// Toolbar icons from the mockups, on the same 24 by 24 grid and stroke as the marks.
export const ICONS: Record<"attach" | "image", readonly string[]> = {
  attach: ["M15.5 7.5 9 14a3 3 0 0 0 4.2 4.2l6.3-6.3a4.5 4.5 0 0 0-6.4-6.4L6.4 12.2"],
  image: ["M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M7.7 10a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0", "M4 16l5-4 3 2.5 3-2.5 5 4"],
};
