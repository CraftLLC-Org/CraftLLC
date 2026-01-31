export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Нормалізуємо шлях: видаляємо зайві слеші на початку та в кінці
    // Наприклад: "//api/recipes/latest/" перетвориться на "api/recipes/latest"
    const cleanPath = url.pathname.replace(/^\/+|\/+$/g, '');

    // API: Latest Recipe
    if (cleanPath === "api/recipes/latest") {
      try {
        const response = await fetch("https://craftllc.pages.dev/recipes/list.json");
        if (!response.ok) throw new Error("Failed to fetch");
        const recipes = await response.json();
        const latestRecipe = recipes[0]; 
        const showBadge = url.searchParams.get("badge") === "true";

        if (showBadge) {
          return new Response(JSON.stringify({
            schemaVersion: 1,
            label: "Рецепт",
            message: latestRecipe.name,
            color: "orange"
          }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }
        return new Response(JSON.stringify(latestRecipe), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Data fetch failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    // API: All Recipes
    if (cleanPath === "api/recipes") {
      try {
        const response = await fetch("https://craftllc.pages.dev/recipes/list.json");
        const recipes = await response.json();
        return new Response(JSON.stringify(recipes), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to load recipes" }), { status: 500 });
      }
    }

    // API: Contacts
    if (cleanPath === "api/contacts") {
      const contacts = {
        email: "craftllcompany@gmail.com",
        telegram: "@CraftLLCSupport",
        socials: {
          telegram: "https://t.me/CraftLLC",
          youtube: "https://m.youtube.com/@CraftLLCOF",
          github: "https://github.com/CraftLLC"
        }
      };
      return new Response(JSON.stringify(contacts), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    // API: Site Info
    if (cleanPath === "api/info") {
      return new Response(JSON.stringify({
        name: "CraftLLC",
        description: "Найкращі перевірені рецепти",
        author: "Андрій Рудик",
        version: "1.2.0"
      }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    // Якщо це не API, повертаємо статичні файли
    return env.ASSETS.fetch(request);
  },
};