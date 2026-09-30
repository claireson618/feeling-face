import AppKit
import Foundation
import WebKit

final class FeelingFaceApp: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var serverProcess: Process?
    private var outputPipe: Pipe?
    private var outputBuffer = Data()
    private let outputLock = NSLock()
    private var loaded = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        installMenu()

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1370, height: 850),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Feeling Face"
        window.center()
        window.minSize = NSSize(width: 780, height: 620)

        let configuration = WKWebViewConfiguration()
        let webView = WKWebView(frame: window.contentView?.bounds ?? .zero, configuration: configuration)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
        self.webView = webView

        showMessage("표정 화면을 준비하고 있습니다…")
        startServer()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        outputPipe?.fileHandleForReading.readabilityHandler = nil
        if serverProcess?.isRunning == true { serverProcess?.terminate() }
    }

    private func installMenu() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Feeling Face 종료", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)
        NSApp.mainMenu = mainMenu
    }

    private func showMessage(_ message: String) {
        let safe = message.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
        webView?.loadHTMLString("""
        <!doctype html><html lang="ko"><meta charset="utf-8">
        <body style="background:#f3efe7;color:#1d1c24;font:20px -apple-system,system-ui;display:grid;place-items:center;height:90vh">
        <div style="max-width:560px;text-align:center;line-height:1.65"><h1 style="color:#ee4939">Feeling Face</h1><p>\(safe)</p></div></body></html>
        """, baseURL: nil)
    }

    private func startServer() {
        guard let resourceURL = Bundle.main.resourceURL else {
            showMessage("앱 리소스를 찾을 수 없습니다.")
            return
        }
        let serverURL = resourceURL.appendingPathComponent("server.mjs")
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Feeling Face", isDirectory: true)
        let keyFile = appSupport.appendingPathComponent(".env")
        guard FileManager.default.fileExists(atPath: keyFile.path) else {
            showMessage("TypeSafe 키 설정을 찾을 수 없습니다. 설치 안내의 키 설정 단계를 확인해 주세요.")
            return
        }

        let nodePaths = ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"]
        guard let nodePath = nodePaths.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else {
            showMessage("Node.js 실행 파일을 찾을 수 없습니다. Node.js를 설치한 뒤 다시 실행해 주세요.")
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: nodePath)
        process.arguments = [serverURL.path]
        var environment = ProcessInfo.processInfo.environment
        environment["PORT"] = "0"
        environment["HOST"] = "127.0.0.1"
        environment["FEELING_FACE_ENV_PATH"] = keyFile.path
        process.environment = environment

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let chunk = handle.availableData
            if !chunk.isEmpty { self?.consumeOutput(chunk) }
        }
        process.terminationHandler = { [weak self] terminated in
            DispatchQueue.main.async {
                guard let self, !self.loaded else { return }
                self.showMessage("로컬 서버가 종료되었습니다 (코드 \(terminated.terminationStatus)). 앱을 다시 열어 보세요.")
            }
        }

        do {
            try process.run()
            serverProcess = process
            outputPipe = pipe
        } catch {
            showMessage("로컬 서버를 시작하지 못했습니다: \(error.localizedDescription)")
        }
    }

    private func consumeOutput(_ chunk: Data) {
        outputLock.lock()
        outputBuffer.append(chunk)
        while let newline = outputBuffer.firstIndex(of: 10) {
            let lineData = outputBuffer.prefix(upTo: newline)
            outputBuffer.removeSubrange(...newline)
            let line = String(decoding: lineData, as: UTF8.self)
            if let range = line.range(of: "Feeling Face: http://127.0.0.1:"),
               let port = Int(line[range.upperBound...].trimmingCharacters(in: .whitespacesAndNewlines)) {
                DispatchQueue.main.async { [weak self] in
                    guard let self, !self.loaded else { return }
                    self.loaded = true
                    self.webView?.load(URLRequest(url: URL(string: "http://127.0.0.1:\(port)/")!))
                }
            }
        }
        outputLock.unlock()
    }
}

let app = NSApplication.shared
let delegate = FeelingFaceApp()
app.delegate = delegate
app.run()
