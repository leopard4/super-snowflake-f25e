export default {
  async fetch(request, env) {
    // GET 요청: HTML 폼 제공
    if (request.method === "GET") {
      const images = await env.MY_BUCKET.list();
      const imageList = images.objects.map(
        (obj) => `<li><a href="/download/${obj.key}" download>${obj.key}</a></li>`
      ).join("");

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>이미지 생성기</title>
            <style>
              /* 스타일 생략 */
            </style>
          </head>
          <body>
            <h1>이미지 생성기</h1>
            <form method="POST">
              <label for="prompt">프롬프트를 입력하세요:</label>
              <input type="text" id="prompt" name="prompt" placeholder="예: cyberpunk cat" required>
              <button type="submit">이미지 생성</button>
            </form>
            <div class="image-container" id="image-container"></div>
            <div class="image-list">
              <h2>이미지 목록</h2>
              <ul>${imageList}</ul>
            </div>
            <script>
              // 폼 제출 시 이미지 표시
              document.querySelector("form").addEventListener("submit", async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                try {
                  const response = await fetch("/", {
                    method: "POST",
                    body: formData,
                  });
                  if (response.ok) {
                    const blob = await response.blob();
                    const imageUrl = URL.createObjectURL(blob);
                    document.getElementById("image-container").innerHTML = \`
                      <img src="\${imageUrl}" alt="생성된 이미지">
                      <a href="\${imageUrl}" download="generated-image.png">이미지 다운로드</a>
                    \`;
                    setTimeout(() => location.reload(), 1000); // 1초 후에 페이지 새로고침
                  } else {
                    const errorText = await response.text();
                    alert(errorText || "이미지 생성에 실패했습니다.");
                  }
                } catch (error) {
                  alert("이미지 생성 중 오류가 발생했습니다.");
                }
              });
            </script>
          </body>
        </html>
      `;
      return new Response(html, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    // 이미지 다운로드 처리
    const url = new URL(request.url);
    if (url.pathname.startsWith("/download/")) {
      const imageKey = url.pathname.split("/download/")[1];
      const image = await env.MY_BUCKET.get(imageKey);

      if (!image) {
        return new Response("이미지 없음", { status: 404 });
      }

      return new Response(image.body, {
        headers: { 
          "content-type": image.httpMetadata.contentType,
          "Content-Disposition": image.httpMetadata.contentDisposition
        },
      });
    }

    // POST 요청: 이미지 생성
    if (request.method === "POST") {
      try {
        const formData = await request.formData();
        const prompt = formData.get("prompt");

        if (!prompt) {
          return new Response("프롬프트 입력 필요", { status: 400 });
        }

        // 빠른모델로 테스트
        const response = await env.AI.run(
          "@cf/stabilityai/stable-diffusion-xl-base-1.0",
          { prompt }
        );

        // 응답 검증
        if (!(response instanceof ArrayBuffer)) {
          throw new Error("AI 모델 응답 오류");
        }

        // R2에 저장
        const imageKey = `images/${Date.now()}.png`;
        await env.MY_BUCKET.put(imageKey, response, {
          contentType: "image/png",
          httpMetadata: {
            contentType: "image/png",
            contentDisposition: `attachment; filename="${imageKey.split('/').pop()}"`
          }
        });

        // 이미지 반환
        return new Response(response, {
          headers: { 
            "content-type": "image/png",
            "Content-Disposition": `attachment; filename="generated-image.png"`
          },
        });
      } catch (error) {
        console.error('Error:', error);
        return new Response(error.message, { status: 500 });
      }
    }

    return new Response("지원하지 않는 메서드", { status: 405 });
  },
} satisfies ExportedHandler<{ AI: any; MY_BUCKET: R2Bucket }>;
