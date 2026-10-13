/** D-08 intown-east pilot ZIP codes. */
export const IN_SERVICE_AREA_ZIPS = new Set([
  "30308", // Midtown
  "30309",
  "30312", // O4W
  "30306", // Inman Park
  "30030", // Decatur
  "30032",
]);

export function isInServiceArea(zip: string): boolean {
  return IN_SERVICE_AREA_ZIPS.has(zip.trim());
}
