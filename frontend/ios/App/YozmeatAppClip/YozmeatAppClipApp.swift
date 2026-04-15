import SwiftUI
import StoreKit

@main
struct YozmeatAppClipApp: App {
    @StateObject private var router = AppClipRouter()

    var body: some Scene {
        WindowGroup {
            AppClipRootView(router: router)
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { userActivity in
                    router.handle(userActivity: userActivity)
                }
                .task {
                    router.loadDebugLaunchURLIfNeeded()
                }
        }
    }
}

private struct AppClipRootView: View {
    @ObservedObject var router: AppClipRouter
    @Environment(\.openURL) private var openURL
    @State private var isLoading = true
    @State private var overlayPresenter = AppClipOverlayPresenter()

    var body: some View {
        ZStack(alignment: .top) {
            Color(.systemBackground)
                .ignoresSafeArea()

            AppClipWebView(url: router.currentURL, isLoading: $isLoading)
                .ignoresSafeArea()

            HStack(spacing: 8) {
                Text("요즘뭐먹")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.primary)

                Text("APP CLIP")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(Color(red: 0.36, green: 0.20, blue: 0.66))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(Color.white.opacity(0.88), in: Capsule())
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial, in: Capsule())
            .padding(.top, 12)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(alignment: .leading, spacing: 12) {
                Text(router.experienceTitle)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.primary)

                if isLoading {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text("요즘뭐먹 화면을 불러오는 중이에요")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                }

                HStack(spacing: 10) {
                    Button {
                        openURL(router.shareableURL)
                    } label: {
                        Text("Safari로 열기")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(AppClipSecondaryButtonStyle())

                    Button {
                        overlayPresenter.presentFullAppOverlay()
                    } label: {
                        Text("전체 앱 받기")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(AppClipPrimaryButtonStyle())
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 12)
            .background(.ultraThinMaterial)
        }
    }
}

private struct AppClipPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(.white)
            .padding(.vertical, 13)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(red: 0.36, green: 0.20, blue: 0.66))
            )
            .opacity(configuration.isPressed ? 0.88 : 1)
    }
}

private struct AppClipSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(.primary)
            .padding(.vertical, 13)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.white.opacity(0.85))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.black.opacity(0.08), lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.88 : 1)
    }
}

@MainActor
private final class AppClipOverlayPresenter: ObservableObject {
    private var overlay: SKOverlay?

    func presentFullAppOverlay() {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene else {
            return
        }

        let configuration = SKOverlay.AppClipConfiguration(position: .bottom)
        let overlay = SKOverlay(configuration: configuration)
        overlay.present(in: scene)
        self.overlay = overlay
    }
}
