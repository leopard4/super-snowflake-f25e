export default {
  async fetch(request, env) {
    try {
      // HTML 폼 제공 (GET 요청)
      if (request.method === "GET") {
        // R2 버킷이 정의되어 있는지 확인
        if (!env.MY_BUCKET) {
          return new Response("R2 버킷이 설정되지 않았습니다.", { status: 500 });
        }
        
        // R2 버킷에서 이미지 목록 가져오기
        let imageList = "";
        try {
          const images = await env.MY_BUCKET.list();
          imageList = images.objects.map(
            (obj) => `<li><a href="/download/${obj.key}" download>${obj.key}</a></li>`
          ).join("");
        } catch (error) {
          console.error("이미지 목록 조회 실패:", error);
          imageList = "<li>이미지 목록을 불러올 수 없습니다.</li>";
        }

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>이미지 생성기</title>
              <style>
                .loading {
                  display: none;
                  text-align: center;
                  margin: 20px 0;
                }
                .error {
                  color: red;
                  margin: 10px 0;
                }
              </style>
            </head>
            <body>
              <h1>이미지 생성기</h1>
              <form method="POST" id="imageForm">
                <label for="prompt">프롬프트를 입력하세요:</label>
                <input type="text" id="prompt" name="prompt" placeholder="예: cyberpunk cat" required>
                <button type="submit">이미지 생성</button>
              </form>
              <div class="loading" id="loading">이미지 생성 중...</div>
              <div class="error" id="error"></div>
              <div class="image-container" id="image-container"></div>
              <div class="image-list">
                <h2>이미지 목록</h2>
                <ul>${imageList}</ul>
              </div>
              <script>
                const form = document.getElementById("imageForm");
                const loading = document.getElementById("loading");
                const error = document.getElementById("error");
                const imageContainer = document.getElementById("image-container");

                form.addEventListener("submit", async (e) => {
                  e.preventDefault();
                  loading.style.display = "block";
                  error.textContent = "";
                  imageContainer.innerHTML = "";

                  try {
                    const formData = new FormData(e.target);
                    const response = await fetch("/", {
                      method: "POST",
                      body: formData,
                    });

                    if (!response.ok) {
                      throw new Error(\`HTTP error! status: \${response.status}\`);
                    }

                    const blob = await response.blob();
                    const imageUrl = URL.createObjectURL(blob);
                    imageContainer.innerHTML = \`
                      <img src="\${imageUrl}" alt="생성된 이미지">
                      <a href="\${imageUrl}" download="generated-image.png">이미지 다운로드</a>
                    \`;
                    location.reload();
                  } catch (err) {
                    error.textContent = "이미지 생성에 실패했습니다: " + err.message;
                  } finally {
                    loading.style.display = "none";
                  }
                });
              </script>
            </body>
          </html>
        `;
        return new Response(html, {
          headers: { "content-type": "text/html" },
        });
      }

      // 이미지 생성 및 저장 (POST 요청)
      if (request.method === "POST") {
        try {
          // 폼 데이터에서 프롬프트 추출
          const formData = await request.formData();
          const prompt = formData.get("prompt");

          if (!prompt) {
            return new Response("프롬프트를 입력해 주세요.", { status: 400 });
          }

          // 이미지 생성
          const response = await env.AI.run(
            "@cf/bytedance/stable-diffusion-xl-lightning", // 콘텐츠 정책이 더 허용적인 모델
            { prompt }
          );

          // 이미지를 R2에 저장
          const imageKey = "images/" + Date.now() + ".png"; // 문자열 연결 사용
          await env.MY_BUCKET.put(imageKey, response); // R2 버킷에 이미지 저장

          // 생성된 이미지 반환
          return new Response(response, {
            headers: { "content-type": "image/png" },
          });
        } catch (error) {
          return new Response("오류 발생: " + (error as Error).message, { status: 500 });
        }
      }

      // 이미지 다운로드 (GET /download/:key)
      const url = new URL(request.url);
      if (url.pathname.startsWith("/download/")) {
        const imageKey = url.pathname.split("/download/")[1];
        const image = await env.MY_BUCKET.get(imageKey);

        if (!image) {
          return new Response("이미지를 찾을 수 없습니다.", { status: 404 });
        }

        return new Response(image.body, {
          headers: { "content-type": "image/png" },
        });
      }

      // 지원하지 않는 메서드
      return new Response("지원하지 않는 메서드입니다.", { status: 405 });
    } catch (error) {
      return new Response("오류 발생: " + (error as Error).message, { status: 500 });
    }
  },
} satisfies ExportedHandler<{ AI: any; MY_BUCKET: R2Bucket }>;
