import { products } from '../data/products';

// Hardcoded OpenRouter API Key
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

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

// --- STRICT LOCAL PARSING ENGINE (Saves the app when API is rate-limited) ---
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

  // 2. Extract Price Constraints (e.g. "under $500", "above 1000", "below 1500")
  let maxPrice = null;
  let minPrice = null;

  const underMatches = lowercaseQuery.match(/(?:under|below|less than|cheaper than|\b<\b)\s*\$?(\d+)/g);
  if (underMatches) {
    // If multiple under/below are matched, take the last one or do custom parsing
    const lastMatch = underMatches[underMatches.length - 1];
    const matchVal = lastMatch.match(/\d+/);
    if (matchVal) maxPrice = parseInt(matchVal[0], 10);
  }

  const overMatches = lowercaseQuery.match(/(?:over|above|greater than|more than|\b>\b)\s*\$?(\d+)/g);
  if (overMatches) {
    const lastMatch = overMatches[overMatches.length - 1];
    const matchVal = lastMatch.match(/\d+/);
    if (matchVal) minPrice = parseInt(matchVal[0], 10);
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
    explanation = `Based on your request, I found **${matchedProducts.length}** product(s) matching your criteria: ${listNames}.`;
  } else {
    explanation = "I couldn't find any products in our catalog matching your exact search criteria. Try modifying your price threshold or category filter.";
  }

  return { recommendedIds, explanation };
}

// System instruction prompt for DeepSeek
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
  "explanation": "string"      // A neat, simple line in natural language explaining why these specific items match. Keep it under 80 words. Make sure to bold matching product names like **product name**.
}

Enforce strict price and category limits! If no products match, return an empty array [] for recommendedIds and a polite note.`;
};

// --- OPENROUTER DEEPSEEK API CALL ---
async function fetchOpenRouterRecommendations(query) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "<OPENROUTER_API_KEY>") {
    throw new Error("OpenRouter API Key is missing. Please provide the key to enable AI recommendations.");
  }

  const url = "https://openrouter.ai/api/v1/chat/completions";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://product-recommender-api.vercel.app", 
      "X-Title": "AI Product Recommender"
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-v4-flash:free",
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
      response_format: { type: "json_object" },
      extra_body: {
        reasoning: {
          enabled: true
        }
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content;
  if (!responseText) {
    throw new Error("Empty response received from OpenRouter.");
  }

  try {
    return JSON.parse(responseText.trim());
  } catch (parseError) {
    console.error("Failed to parse JSON response from DeepSeek:", responseText);
    throw new Error("Received invalid formatting from AI model. Please try again.");
  }
}

// --- UNIFIED CONTROLLER WITH SEAMLESS FALLBACK ---
export async function getRecommendations(query) {
  try {
    // 1. Try to fetch from OpenRouter DeepSeek
    return await fetchOpenRouterRecommendations(query);
  } catch (error) {
    console.warn("OpenRouter API failed or is rate-limited. Falling back to local strict filtering:", error);
    
    // 2. Silently fall back to our local parser if OpenRouter is rate-limited (429) or offline!
    return getLocalRecommendations(query);
  }
}
