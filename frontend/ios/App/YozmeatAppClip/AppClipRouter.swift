import Foundation

@MainActor
final class AppClipRouter: ObservableObject {
    private static let fallbackURL = URL(string: "https://www.yozmeat.com/")!
    private static let allowedHosts = Set(["yozmeat.com", "www.yozmeat.com"])

    @Published private(set) var currentURL = AppClipRouter.appClipURL(for: AppClipRouter.fallbackURL)
    @Published private(set) var shareableURL = AppClipRouter.fallbackURL
    @Published private(set) var experienceTitle = "지금 뜨는 음식 트렌드를 바로 확인해보세요"

    private var didLoadInitialURL = false

    func handle(userActivity: NSUserActivity) {
        guard
            userActivity.activityType == NSUserActivityTypeBrowsingWeb,
            let incomingURL = userActivity.webpageURL
        else {
            return
        }

        didLoadInitialURL = true
        update(using: incomingURL)
    }

    func loadDebugLaunchURLIfNeeded() {
        guard !didLoadInitialURL else {
            return
        }

        didLoadInitialURL = true

        if
            let rawURL = ProcessInfo.processInfo.environment["_XCAppClipURL"],
            let debugURL = URL(string: rawURL)
        {
            update(using: debugURL)
            return
        }

        update(using: Self.fallbackURL)
    }

    private func update(using incomingURL: URL) {
        let normalizedURL = Self.normalizedIncomingURL(incomingURL)
        shareableURL = normalizedURL
        currentURL = Self.appClipURL(for: normalizedURL)
        experienceTitle = Self.title(for: normalizedURL)
    }

    private static func normalizedIncomingURL(_ url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return fallbackURL
        }

        if components.scheme?.lowercased() != "https" {
            components.scheme = "https"
        }

        guard
            let host = components.host?.lowercased(),
            allowedHosts.contains(host)
        else {
            return fallbackURL
        }

        if components.path.isEmpty {
            components.path = "/"
        }

        return components.url ?? fallbackURL
    }

    private static func appClipURL(for url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return fallbackURL
        }

        var queryItems = components.queryItems ?? []
        let hasAppClipFlag = queryItems.contains { $0.name == "appClip" }

        if !hasAppClipFlag {
            queryItems.append(URLQueryItem(name: "appClip", value: "1"))
        }

        components.queryItems = queryItems.isEmpty ? nil : queryItems
        return components.url ?? url
    }

    private static func title(for url: URL) -> String {
        if url.path.hasPrefix("/trend/") {
            return "트렌드 판매처를 바로 살펴보세요"
        }

        if url.path.hasPrefix("/map") {
            return "내 주변 판매처 지도를 빠르게 열었어요"
        }

        if url.path.hasPrefix("/new") {
            return "신상 음식을 바로 확인해보세요"
        }

        if url.path.hasPrefix("/report") {
            return "먹어본 판매처를 바로 제보할 수 있어요"
        }

        return "지금 뜨는 음식 트렌드를 바로 확인해보세요"
    }
}
