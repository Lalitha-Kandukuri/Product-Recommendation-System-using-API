import { products } from '../data/products';

/**
 * Unified recommendation service supporting:
 * 1. Strict deterministic Local NLP engine (solves filtering issues)
 * 2. Google Gemini API (gemini-2.5-flash)
 * 3. OpenAI API (gpt-4o-mini)
 */

// Helper to simulate text streaming
export const streamText = (fullText, callback, speed = 10) => {
  let index = 0;
  const interval = setInterval(() => {
    callback(fullText.substring(0, index + 1));
    index++;
    if (index >= fullText.length) {
      clearInterval(interval);
    }
  }, speed);
  return () => clearInterval(interval);
};

// --- STRICT LOCAL PARSING ENGINE ---
function getLocalRecommendations(query) {
  const lowercaseQuery = query.toLowerCase().trim();
  
  // 1. Extract Category Constraints
  let targetCategory = null;
  if (lowercaseQuery.match(/\b(phone|phones|mobile|cellphone)\b/)) {
    targetCategory = "Phone";
  } else if (lowercaseQuery.match(/\b(laptop|laptops|computer|notebook|pc)\b/)) {
    targetCategory = "Laptop";
  } else if (lowercaseQuery.match(/\b(headphone|headphones|earbud|earbuds|pods|audio|sound)\b/)) {
    targetCategory = "Headphones";
  }

  // 2. Extract Price Constraints (e.g. "under $500")
  let maxPrice = null;
  let minPrice = null;

  const underMatch = lowercaseQuery.match(/(?:under|below|less than|cheaper than|\b<\b)\s*\$?(\d+)/);
  if (underMatch) {
    maxPrice = parseInt(underMatch[1], 10);
  }

  const overMatch = lowercaseQuery.match(/(?:over|above|greater than|more than|\b>\b)\s*\$?(\d+)/);
  if (overMatch) {
    minPrice = parseInt(overMatch[1], 10);
  }

  // 3. Perform Strict Filtering
  let matchedProducts = [...products];

  // Apply strict category filter if mentioned
  if (targetCategory) {
    matchedProducts = matchedProducts.filter(p => p.category === targetCategory);
  }

  // Apply strict maximum price filter
  if (maxPrice !== null) {
    matchedProducts = matchedProducts.filter(p => p.price < maxPrice);
  }

  // Apply strict minimum price filter
  if (minPrice !== null) {
    matchedProducts = matchedProducts.filter(p => p.price > minPrice);
  }

  // If no price or category filters were detected, fallback to search terms
  if (!targetCategory && maxPrice === null && minPrice === null) {
    matchedProducts = products.filter(product => {
      const nameMatch = product.name.toLowerCase().includes(lowercaseQuery);
      const descMatch = product.description.toLowerCase().includes(lowercaseQuery);
      const tagMatch = product.tags.some(t => lowercaseQuery.includes(t.toLowerCase()));
      return nameMatch || descMatch || tagMatch;
    });
  }

  const recommendedIds = matchedProducts.map(p => p.id);

  // Generate neat, simple, clean explanation
  let explanation = "";
  if (recommendedIds.length > 0) {
    const listNames = matchedProducts.map(p => `**${p.name}** ($${p.price})`).join(", ");
    explanation = `I found **${matchedProducts.length}** product(s) matching your request: ${listNames}.`;
  } else {
    explanation = "I couldn't find any products in our catalog matching your exact search criteria. Try modifying your price threshold or category filter.";
  }

  return { recommendedIds, explanation };
}

// --- SYSTEM INSTRUCTION FOR CLOUD MODELS ---
const getSystemInstruction = () => {
  return `You are a shopping assistant that strictly recommends products from our catalog.
Here is our catalog data: ${JSON.stringify(products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    description: p.description,
    tags: p.tags
  })))}

You must respond in strict JSON format matching this schema:
{
  "recommendedIds": [number], // Array of matching product IDs. Filter strictly based on the user's requirements (e.g. if they say "under $500", do NOT include products >= $500!).
  "explanation": "string"      // A neat, simple line summarizing the matches. Keep it under 100 words. Make sure to bold matching product names like **product name**.
}

Enforce strict price and category limits! If no products match, return an empty array [] for recommendedIds.`;
};

// --- GEMINI API CALL ---
async function fetchGeminiRecommendations(query, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${getSystemInstruction()}\n\nUser request: "${query}"`
        }]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error("Empty response received from Gemini.");
  }

  return JSON.parse(responseText.trim());
}

// --- OPENAI API CALL ---
async function fetchOpenAiRecommendations(query, apiKey) {
  const url = "https://api.openai.com/v1/chat/completions";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: getSystemInstruction()
        },
        {
          role: "user",
          content: query
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content;
  if (!responseText) {
    throw new Error("Empty response received from OpenAI.");
  }

  return JSON.parse(responseText.trim());
}

// --- UNIFIED CONTROLLER ---
export async function getRecommendations(query, provider = "local", apiKey = "") {
  if (provider === "gemini") {
    if (!apiKey) throw new Error("Google Gemini API Key is required.");
    return await fetchGeminiRecommendations(query, apiKey);
  } else if (provider === "openai") {
    if (!apiKey) throw new Error("OpenAI API Key is required.");
    return await fetchOpenAiRecommendations(query, apiKey);
  } else {
    // Local fallback
    return getLocalRecommendations(query);
  }
}
