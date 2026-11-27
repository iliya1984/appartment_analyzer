/** Natural size of public/site.jpg (the project render used as the map). */
export const SITE_W = 1100;
export const SITE_H = 527;

/** Building hotspot centres, in image pixels. */
export const SITE_PTS: Readonly<Record<string, readonly [number, number]>> = {
  A1: [525, 66],
  B2: [383, 164],
  C3: [430, 197],
  B4: [486, 210],
  B5: [557, 192],
  B6: [622, 165],
  A7: [767, 154],
  B12: [678, 192],
  C11: [614, 228],
  B10: [504, 264],
  B9: [616, 291],
  B8: [740, 280],
  D13: [401, 290],
  C14: [427, 343],
  D15: [485, 371],
};

export const SITE_IMAGE = `${import.meta.env.BASE_URL}site.jpg`;
