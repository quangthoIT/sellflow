import { toast } from "sonner";

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "tai-lieu";
}

function cleanHtmlForExport(rawHtml: string, target: "pdf" | "word"): string {
  if (typeof window === "undefined") return rawHtml;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    // Replace all visual page break elements with invisible native page breaks
    const pageBreaks = doc.querySelectorAll('[data-page-break="true"], [data-page-break], div[style*="page-break-before"]');
    pageBreaks.forEach((el) => {
      if (target === "word") {
        const br = doc.createElement("br");
        br.setAttribute("clear", "all");
        br.setAttribute("style", "page-break-before: always; mso-break-type: section-break;");
        el.replaceWith(br);
      } else {
        const div = doc.createElement("div");
        div.className = "html2pdf__page-break";
        div.setAttribute(
          "style",
          "page-break-before: always; break-before: page; height: 0; line-height: 0; font-size: 0; margin: 0; padding: 0; border: none; background: transparent; color: transparent; visibility: hidden; overflow: hidden;"
        );
        el.replaceWith(div);
      }
    });

    return doc.body.innerHTML;
  } catch {
    // Fallback regex replacement if DOMParser fails
    if (target === "word") {
      return rawHtml.replace(/<div[^>]*data-page-break[^>]*>[\s\S]*?<\/div>/gi, '<br clear="all" style="page-break-before:always; mso-break-type:section-break;" />');
    }
    return rawHtml.replace(
      /<div[^>]*data-page-break[^>]*>[\s\S]*?<\/div>/gi,
      '<div class="html2pdf__page-break" style="page-break-before: always; break-before: page; height: 0; line-height: 0; font-size: 0; margin: 0; padding: 0; border: none; visibility: hidden;"></div>'
    );
  }
}

async function getHtml2Pdf(): Promise<any> {
  if (typeof window === "undefined") return null;
  if ((window as any).html2pdf) return (window as any).html2pdf;

  try {
    // @ts-ignore
    const mod = await import("html2pdf.js");
    let fn = (mod as any).default || mod;
    if (typeof fn === "function") return fn;
    if (fn && typeof fn.default === "function") return fn.default;
  } catch (err) {
    console.warn("Webpack module load failed, fallback to script injection:", err);
  }

  // Fallback: load bundle from reliable script CDN if webpack bundle fails
  if (!(window as any).html2pdf) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[src*="html2pdf"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Không thể tải thư viện xuất PDF"));
      document.head.appendChild(script);
    });
  }

  return (window as any).html2pdf;
}

export async function downloadPdf(title: string, html: string) {
  if (typeof window === "undefined") return;
  const toastId = toast.loading("Đang khởi tạo và tải file PDF...");
  try {
    const html2pdfFn = await getHtml2Pdf();
    if (!html2pdfFn || typeof html2pdfFn !== "function") {
      throw new Error("html2pdf library is not available as a function");
    }

    const cleanHtml = cleanHtmlForExport(html, "pdf");
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = "794px"; // Standard A4 width in px at 96 DPI (210mm)
    container.style.background = "#ffffff";
    container.style.color = "#000000";
    container.style.fontFamily = "'Times New Roman', Times, serif";
    container.style.padding = "20px 24px";
    container.style.boxSizing = "border-box";
    container.innerHTML = cleanHtml;
    document.body.appendChild(container);

    const opt = {
      margin: [10, 10, 10, 10], // mm margins
      filename: `${slugify(title)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], before: [".html2pdf__page-break", '[data-page-break="true"]', '[data-page-break]'] },
    };

    await html2pdfFn().set(opt).from(container).save();
    document.body.removeChild(container);
    toast.success("Đã tải xong file PDF!", { id: toastId });
  } catch (err) {
    console.error("Direct PDF generation fallback:", err);
    toast.error("Đang mở hộp thoại in / xuất PDF...", { id: toastId });
    // Fallback if browser security or web-worker blocks canvas
    const win = window.open("", "_blank");
    if (win) {
      const cleanHtml = cleanHtmlForExport(html, "pdf");
      win.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  html, body { margin: 0; padding: 0; color: #000; background: #fff; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .html2pdf__page-break, [data-page-break="true"] { page-break-before: always !important; display: block !important; height: 0 !important; visibility: hidden !important; }
  }
</style>
</head>
<body>${cleanHtml}
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 300); };
</script>
</body></html>`);
      win.document.close();
    }
  }
}

export function downloadWord(title: string, html: string) {
  const cleanHtml = cleanHtmlForExport(html, "word");
  const header = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${title}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
body { margin: 0; padding: 0; font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.4; color: #000; }
table { border-collapse: collapse; width: 100%; }
</style>
</head><body>`;
  const footer = "</body></html>";
  const content = header + cleanHtml + footer;
  const blob = new Blob(["\ufeff" + content], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(title)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
