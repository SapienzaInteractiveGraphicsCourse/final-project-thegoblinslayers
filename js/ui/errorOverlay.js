function showErrorOverlay(message) {
  let overlay = document.getElementById('error-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'error-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '16px',
      right: '16px',
      top: '16px',
      padding: '12px',
      background: 'rgba(200,50,50,0.95)',
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
      zIndex: 9999,
      borderRadius: '6px'
    });
    document.body.appendChild(overlay);
  }


  // If message is an Error or contains stack info, show it
  overlay.textContent = '';
  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.style.marginBottom = '6px';
  title.textContent = 'Errore: ' + message;
  overlay.appendChild(title);


  // Try to include a stack trace if present in the message string
  if (typeof message === 'string' && message.indexOf('\n') !== -1) {
    const pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.margin = '0';
    pre.textContent = message;
    overlay.appendChild(pre);
  }


  // Also log to console the overlay content for copy-paste
  console.error('Error overlay shown:', message);
}