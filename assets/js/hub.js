/**
 * 國中生物數位學習單總覽與白板派發大廳 (Common Utilities)
 * 整合 QR Code 彈窗、剪貼簿複製與視窗控制
 */

// 取得學習單絕對網址
function getAbsoluteSheetUrl(relativePath) {
  const loc = window.location;
  const path = loc.pathname.substring(0, loc.pathname.lastIndexOf('/') + 1);
  return loc.origin + path + relativePath;
}

// 複製網址到剪貼簿
function copyToClipboard(text, btnElement) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showCopiedFeedback(btnElement);
    }).catch(() => {
      fallbackCopy(text, btnElement);
    });
  } else {
    fallbackCopy(text, btnElement);
  }
}

function fallbackCopy(text, btnElement) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showCopiedFeedback(btnElement);
  } catch (err) {
    alert("複製失敗，請手動複製網址：" + text);
  }
  document.body.removeChild(textArea);
}

function showCopiedFeedback(btnElement) {
  if (!btnElement) return;
  const originalText = btnElement.innerHTML;
  btnElement.innerHTML = "✅ 已複製連結！";
  btnElement.style.background = "#10b981";
  btnElement.style.borderColor = "#10b981";
  btnElement.style.color = "#ffffff";
  setTimeout(() => {
    btnElement.innerHTML = originalText;
    btnElement.style.background = "";
    btnElement.style.borderColor = "";
    btnElement.style.color = "";
  }, 2000);
}

// 顯示白板全螢幕 QR Code 投影彈窗
function showQrModal(url, title) {
  let modal = document.getElementById('whiteboardQrModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'whiteboardQrModal';
    modal.className = 'wb-modal-overlay';
    modal.innerHTML = `
      <div class="wb-modal-card">
        <div class="wb-modal-header">
          <div class="wb-badge">📡 電子白板課堂派發模式</div>
          <h2 class="wb-title" id="wbModalTitle">學習單派發</h2>
          <button type="button" class="wb-close-btn" onclick="closeQrModal()">✕</button>
        </div>
        <div class="wb-modal-body">
          <div class="wb-qr-frame">
            <div id="wbModalQrCode"></div>
          </div>
          <div class="wb-instruction">
            <p class="wb-tip-main">📱 請全班同學拿起平板 / 手機相機，對準上方 QR Code 掃描立即進入作答</p>
            <div class="wb-url-box" id="wbModalUrl">...</div>
          </div>
        </div>
        <div class="wb-modal-footer">
          <button type="button" class="btn-wb-copy" onclick="copyModalUrl(this)">📋 複製派發網址</button>
          <button type="button" class="btn-wb-enter" id="wbModalDirectBtn">🚀 老師進入網頁</button>
          <button type="button" class="btn-wb-close" onclick="closeQrModal()">關閉投影</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeQrModal();
    });
  }

  document.getElementById('wbModalTitle').textContent = title;
  document.getElementById('wbModalUrl').textContent = url;
  document.getElementById('wbModalDirectBtn').onclick = () => window.open(url, '_blank');

  const qrContainer = document.getElementById('wbModalQrCode');
  qrContainer.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: url,
      width: 280,
      height: 280,
      colorDark: "#0369a1",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    const img = document.createElement('img');
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&color=0369a1&data=' + encodeURIComponent(url);
    img.alt = 'QR Code';
    qrContainer.appendChild(img);
  }

  modal.classList.add('active');
}

function closeQrModal() {
  const modal = document.getElementById('whiteboardQrModal');
  if (modal) modal.classList.remove('active');
}

function copyModalUrl(btn) {
  const url = document.getElementById('wbModalUrl').textContent;
  copyToClipboard(url, btn);
}
