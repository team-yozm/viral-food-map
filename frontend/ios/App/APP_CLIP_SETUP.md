# App Clip 배포 체크리스트

요즘뭐먹 App Clip은 `YozmeatAppClip` 타깃으로 추가되어 있습니다. 코드 반영 후 실제 배포까지는 아래 작업이 추가로 필요합니다.

## 1. Xcode / Certificates

- `Signing & Capabilities`에서 `YozmeatAppClip` 타깃의 bundle id가 `com.yozmeat.app.Clip`으로 잡혔는지 확인
- `Associated Domains`에 `appclips:yozmeat.com`, `appclips:www.yozmeat.com`가 포함되어 있는지 확인
- 부모 앱 `App` 타깃은 기존 `applinks:` 설정을 그대로 유지

## 2. App Store Connect

- App Store Connect에서 부모 앱 빌드와 App Clip이 함께 업로드된 빌드를 선택
- `Default App Clip Experience` 생성
- `Default App Clip Experience`는 메인 화면(`/`) 기준으로 잡기
- 필요하면 `/trend`, `/map` 기준으로 `Advanced App Clip Experience`를 추가
- QR/NFC/메시지 공유용 URL prefix는 가장 짧은 공통 prefix 위주로 등록

## 3. 웹 배포 환경 변수

- Safari Smart App Banner를 켜려면 Vercel에 `NEXT_PUBLIC_IOS_APP_ID`를 추가
- 값은 App Store의 실제 iOS 앱 ID 숫자값
- 값이 없으면 Smart App Banner 메타 태그는 렌더링되지 않음

## 4. 로컬 테스트

- Xcode에서 `YozmeatAppClip` 스킴 실행
- `Edit Scheme > Run > Arguments`에서 `_XCAppClipURL` 환경 변수 추가
- 예시 값

```text
https://www.yozmeat.com/trend/1?appClip=1
```

## 5. 서버 확인 포인트

- `/.well-known/apple-app-site-association` 응답에 App Clip bundle id가 포함되어야 함
- `Content-Type`은 `application/json`
- App Clip 웹뷰는 `yozmeat-appclip` user agent 토큰과 `appClip=1` 쿼리로 가벼운 웹 UI를 사용
