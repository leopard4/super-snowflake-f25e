export default {
  async fetch(request, env) {
    // 요청이 GET인 경우 (웹 페이지 표시)
    if (request.method === "GET") {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Stable Diffusion Image Generator</title>
          </head>
          <body>
            <h1>Stable Diffusion Image Generator</h1>
            <form method="POST">
              <label for="prompt">Enter a prompt:</label><br>
              <input type="text" id="prompt" name="prompt" placeholder="e.g., cyberpunk cat"><br><br>
              <button type="submit">Generate Image</button>
            </form>
          </body>
        </html>
      `;
      return new Response(html, {
        headers: { "content-type": "text/html" },
      });
    }

    // 요청이 POST인 경우 (사용자 입력 처리)
    if (request.method === "POST") {
      try {
        // FormData에서 사용자 입력 추출
        const formData = await request.formData();
        const prompt = formData.get("prompt");

        // 입력값이 없는 경우 에러 반환
        if (!prompt) {
          return new Response("Prompt is required", { status: 400 });
        }

        // AI 모델 실행
        const response = await env.AI.run(
          "@cf/stabilityai/stable-diffusion-xl-base-1.0",
          { prompt }
        );

        // 이미지 반환
        return new Response(response, {
          headers: { "content-type": "image/png" },
        });
      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }

    // 지원하지 않는 메서드인 경우
    return new Response("Method Not Allowed", { status: 405 });
  },
} satisfies ExportedHandler<Env>;
