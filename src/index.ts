export default {
  async fetch(request, env) {
    // HTML 폼 제공 (GET 요청)
    if (request.method === "GET") {
      // R2 버킷에서 이미지 목록 가져오기
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
              body {
                font-family: Arial, sans-serif;
                margin: 20px;
                padding: 0;
                background-color: #f4f4f9;
                color: #333;
              }
              h1 {
                color: #444;
              }
              form {
                background: #fff;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                max-width: 500px;
                margin: 0 auto;
              }
              label {
                font-weight: bold;
                display: block;
                margin-bottom: 8px;
              }
              input[type="text"] {
                width: 100%;
                padding: 10px;
                margin-bottom: 20px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 16px;
              }
              button {
                background-color: #007BFF;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
              }
              button:hover {
                background-color: #0056b3;
              }
              .image-container {
                margin-top: 20px;
                text-align: center;
              }
              img {
                max-width: 100%;
                border-radius: 8px;
              }
              .image-list {
                margin-top: 20px;
                background: #fff;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                max-width: 500px;
                margin: 20px auto;
              }
              .image-list ul {
                list-style-type: none;
                padding: 0;
              }
              .image-list li {
                margin: 10px 0;
              }
              .image-list a {
                text-decoration: none;
                color: #007BFF;
              }
              .image-list a:hover {
                text-decoration: underline;
              }
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
                  location.reload(); // 이미지 목록 갱신
                } else {
                  alert("이미지 생성에 실패했습니다.");
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
        const imageKey = \`images/\${Date.now()}.png\`; // 고유한 파일 이름 생성
        await env.MY_BUCKET.put(imageKey, response); // R2 버킷에 이미지 저장

        // 생성된 이미지 반환
        return new Response(response, {
          headers: { "content-type": "image/png" },
        });
      } catch (error) {
        return new Response(\`오류 발생: \${error.message}\`, { status: 500 });
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
  },
} satisfies ExportedHandler<{ AI: any; MY_BUCKET: R2Bucket }>;
