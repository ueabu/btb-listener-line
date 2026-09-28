export interface Speaker {
  name: string;
  city: string;
  country: string;
}

/**
 * Pull name, city and country out of the "Name to credit" field for the intro line.
 * "Tobi from London, UK" / "Tobi in London in UK" → { name: "Tobi", city: "London", country: "UK" }.
 * Anything missing comes back as a [bracketed] prompt for the listener to fill in out loud.
 */
export function parseSpeaker(input: string): Speaker {
  const text = input.trim();
  const m = text.match(/^(.*?)\s+(?:from|in)\s+(.*)$/i);
  const name = (m ? m[1] : text).trim();
  const [city, country] = m ? m[2].split(/\s*,\s*|\s+in\s+/i, 2).map((s) => s.trim()) : [];
  return {
    name: name || "[your name]",
    city: city || "[your city]",
    country: country || "[your country]",
  };
}
