import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw, Trash2 } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleClearStorageAndReset = () => {
    try {
      localStorage.removeItem("scitech_links");
      localStorage.removeItem("scitech_admin_config");
      localStorage.removeItem("scitech_lang");
      localStorage.removeItem("scitech_translations_cache_v1");
      sessionStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans text-slate-800">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold mb-2">เกิดข้อผิดพลาดในการโหลดหน้าเว็บ</h2>
            <p className="text-sm text-slate-500 mb-4">
              ระบบตรวจพบข้อผิดพลาดที่ไม่คาดคิด กรุณารีเฟรชหน้าเว็บหรือคลิกปุ่มด้านล่างเพื่อเริ่มใหม่อีกครั้ง
            </p>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-rose-600 cursor-pointer font-medium hover:underline">
                  ดูรายละเอียดข้อผิดพลาด (Technical details)
                </summary>
                <pre className="mt-2 text-[11px] bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl overflow-x-auto max-h-36 whitespace-pre-wrap break-all">
                  {this.state.error.message || String(this.state.error)}
                </pre>
              </details>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#5c0620] hover:bg-[#4a051a] text-white font-medium text-sm rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                โหลดหน้าเว็บใหม่ (Reload)
              </button>
              <button
                onClick={this.handleClearStorageAndReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-colors cursor-pointer"
                title="ล้างแคชในเครื่องแล้วเริ่มใหม่"
              >
                <Trash2 className="w-4 h-4 text-slate-500" />
                ล้างแคชและเริ่มใหม่
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
