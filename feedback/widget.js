(function() {
  // 💡 顶层配置区：改颜色改图标在这里改
  const config = {
    themeColor: "#000000", // 悬浮球背景颜色
    iconColor: "#ffffff",  // 图标线条颜色
    iframeSrc: "{{WORKER_URL}}feedback-ui" // 自动定位到留言界面
  };

  if (document.getElementById('fb-widget-container')) return;
  
  var initWidget = function() {
    if (!document.body) { setTimeout(initWidget, 100); return; }
    
    var container = document.createElement('div');
    container.id = 'fb-widget-container';
    Object.assign(container.style, { 
      position: 'fixed', 
      bottom: '20px', 
      right: '20px', 
      zIndex: '999999', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'flex-end' 
    });
    
    var panel = document.createElement('iframe');
    Object.assign(panel.style, { 
      width: '350px', 
      height: '520px', 
      maxHeight: 'calc(100vh - 100px)', // 防移动端小屏高度溢出
      maxWidth: '85vw', 
      border: 'none', 
      borderRadius: '16px', 
      boxShadow: '0 12px 40px rgba(0,0,0,0.18)', 
      marginBottom: '16px', 
      display: 'none', 
      backgroundColor: '#ffffff' 
    });
    
    var button = document.createElement('div');
    Object.assign(button.style, { 
      width: '50px', 
      height: '50px', 
      backgroundColor: config.themeColor, 
      borderRadius: '50%', 
      cursor: 'pointer', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
      transition: 'transform 0.2s ease', 
      userSelect: 'none' 
    });
    
    var svgIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${config.iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
    var closeIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${config.iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    
    button.innerHTML = svgIcon;
    button.onmouseover = function() { button.style.transform = 'scale(1.08)'; };
    button.onmouseout = function() { button.style.transform = 'scale(1)'; };
    
    var isOpen = false;
    var isIframeLoaded = false;
    
    // 切换展开/收起状态
    function toggleWidget(show) {
      isOpen = (show !== undefined) ? show : !isOpen;
      if (isOpen) {
        if (!isIframeLoaded) { 
          panel.src = config.iframeSrc; 
          isIframeLoaded = true; 
        }
        panel.style.display = 'block';
        button.innerHTML = closeIcon;
      } else {
        panel.style.display = 'none';
        button.innerHTML = svgIcon;
      }
    }

    button.onclick = function() { toggleWidget(); };
    
    // 💡 监听来自 iframe 内部发来的关闭指令 (例如 window.parent.postMessage('xw-feedback-close', '*'))
    window.addEventListener('message', function(e) {
      if (e.data === 'xw-feedback-close') {
        toggleWidget(false);
      }
    });

    container.appendChild(panel);
    container.appendChild(button);
    document.body.appendChild(container);
  };
  
  if (document.readyState === 'complete' || document.readyState === 'interactive') { 
    initWidget(); 
  } else { 
    window.addEventListener('load', initWidget); 
  }
})();
