import UIKit
import Capacitor

class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()

        guard let scrollView = webView?.scrollView else {
            return
        }

        scrollView.bounces = true
        scrollView.alwaysBounceVertical = true
    }
}
