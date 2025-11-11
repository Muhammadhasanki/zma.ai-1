fetch("/.netlify/functions/gemini", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: userInput }) // userInput = variable holding your prompt text
})
.then(res => res.json())
.then(data => {
  console.log("Gemini response:", data); // handle data in your app
})
.catch(err => {
  console.error("Error calling Netlify function:", err);
});
