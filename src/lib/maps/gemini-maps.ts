/**
 * Placeholder for Google Gemini map / places search integration.
 * Wire your API key and endpoint env vars when Google provides access details.
 */

export type MapSearchResult = {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

export async function searchPlacesWithGeminiMaps(_query: string): Promise<MapSearchResult[]> {
  void _query;
  throw new Error(
    "Gemini Maps search is not configured. Set the env vars you receive from Google and implement searchPlacesWithGeminiMaps in src/lib/maps/gemini-maps.ts.",
  );
}
