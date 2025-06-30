// Static preview system for when WebContainer is not available
export const generateStaticReactPreview = (files: Record<string, any>) => {
  console.log('🔍 DEBUG: Generating static preview for files:', Object.keys(files));
  
  // Debug: log each file's content preview
  Object.entries(files).forEach(([path, file]) => {
    const content = typeof file?.content === 'string' ? file.content : String(file?.content || '');
    console.log(`📄 File ${path}: ${content.length} chars, starts with: "${content.slice(0, 100)}"`);
  });
  
  // First, filter out files with "[object Promise]" content
  const validFiles = Object.fromEntries(
    Object.entries(files).filter(([path, file]) => {
      const content = typeof file.content === 'string' ? file.content : String(file.content || '');
      const isValid = !content.includes('[object Promise]') && content.trim().length > 0;
      if (!isValid) {
        console.log(`❌ Filtered out ${path}: Promise or empty content`);
      }
      return isValid;
    })
  );
  
  console.log('✅ Valid files after filtering:', Object.keys(validFiles));
  
  // Strategy: Try to find the main UI file regardless of type
  
  // 1. Check for HTML files (complete websites)
  const htmlFile = validFiles['index.html'] || validFiles['main.html'] || validFiles['home.html'];
  if (htmlFile) {
    console.log('Found HTML file, generating HTML preview');
    return generateHTMLPreview(htmlFile, validFiles);
  }
  
  // 2. Check for React App components
  const appFile = validFiles['src/App.tsx'] || validFiles['src/App.jsx'] || validFiles['App.tsx'] || validFiles['App.jsx'];
  if (appFile) {
    console.log('Found React App component, generating React preview');
    console.log('App file content preview:', typeof appFile.content === 'string' ? appFile.content.slice(0, 200) : 'Not a string');
    return generateComponentPreview(appFile, validFiles, 'React App');
  }
  
  // DEBUG: Let's see what files we have
  console.log('🔍 No App.tsx found. Available files:', Object.keys(validFiles));
  console.log('🔍 Files in src/ folder:', Object.keys(validFiles).filter(path => path.startsWith('src/')));
  
  // 3. Check for any React component files
  const componentFiles = Object.entries(validFiles).filter(([path, file]) => {
    const content = typeof file.content === 'string' ? file.content : String(file.content || '');
    return (path.includes('.tsx') || path.includes('.jsx')) && 
           content.includes('React') && 
           content.includes('return');
  });
  
  if (componentFiles.length > 0) {
    console.log('Found React component files:', componentFiles.map(([path]) => path));
    const [componentPath, componentFile] = componentFiles[0];
    return generateComponentPreview(componentFile, validFiles, componentPath);
  }
  
  // 4. Check for any UI-related files (even if not React)
  const uiFiles = Object.entries(validFiles).filter(([path, file]) => {
    const content = typeof file.content === 'string' ? file.content : String(file.content || '');
    return path.includes('.js') || path.includes('.ts') || path.includes('.css') || 
           content.includes('<div') || content.includes('<html') || content.includes('component');
  });
  
  if (uiFiles.length > 0) {
    console.log('Found UI-related files, attempting to render:', uiFiles.map(([path]) => path));
    const [filePath, file] = uiFiles[0];
    
    // Try to render as component if it has JSX-like content
    const content = typeof file.content === 'string' ? file.content : String(file.content || '');
    if (content.includes('<') && (content.includes('div') || content.includes('html'))) {
      return generateComponentPreview(file, validFiles, filePath);
    }
  }
  
  // 5. FALLBACK: If we have any files at all, show them with a test preview
  if (Object.keys(validFiles).length > 0) {
    console.log('🧪 Creating test preview with available files');
    const testContent = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1>🧪 Test Preview</h1>
        <p>Found ${Object.keys(validFiles).length} files but couldn't render them as UI components.</p>
        <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3>Files Detected:</h3>
          <ul>
            ${Object.keys(validFiles).map(path => `<li><strong>${path}</strong></li>`).join('')}
          </ul>
        </div>
        <p>This might indicate an issue with the file content or preview system.</p>
      </div>
    `;
    return generatePreviewHTML(testContent, validFiles, 'Test Preview');
  }
  
  console.log('❌ No renderable UI content found, showing file list preview');
  console.log('💡 This might be why the preview is blank - no UI content detected');
  
  // DEBUG: If we have any files, let's try to create a simple preview anyway
  if (Object.keys(validFiles).length > 0) {
    console.log('🔧 Creating emergency fallback preview...');
    const fileList = Object.entries(validFiles).map(([path, file]) => {
      const content = typeof file.content === 'string' ? file.content : String(file.content || '');
      const contentPreview = content.slice(0, 300).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <div style="margin: 16px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
          <h3 style="margin: 0 0 8px 0; color: #374151; font-family: monospace; font-size: 14px;">${path}</h3>
          <pre style="margin: 0; font-size: 12px; color: #6b7280; white-space: pre-wrap; word-break: break-word;">${contentPreview}${content.length > 300 ? '...' : ''}</pre>
        </div>
      `;
    }).join('');
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Generated Files Preview</title>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; background: #fff; }
            h1 { color: #111827; margin-bottom: 24px; }
            .success { color: #059669; font-weight: 500; }
          </style>
        </head>
        <body>
          <h1>🎉 <span class="success">AI Generated Files</span></h1>
          <p>Found ${Object.keys(validFiles).length} generated files. Below is a preview:</p>
          ${fileList}
        </body>
      </html>
    `;
  }
  
  return generateCodePreview(validFiles);
};

const generateHTMLPreview = (htmlFile: any, allFiles: Record<string, any>) => {
  const htmlContent = typeof htmlFile.content === 'string' ? htmlFile.content : String(htmlFile.content || '');
  console.log('HTML content preview (first 400 chars):', htmlContent.slice(0, 400));
  
  // Check if this is a complete HTML document
  if (htmlContent.includes('<!DOCTYPE') || htmlContent.includes('<html')) {
    console.log('Complete HTML document detected - using as-is');
    
    // Inject additional CSS and JS files if they exist
    let modifiedHTML = htmlContent;
    
    // Inject CSS
    const cssFile = allFiles['styles.css'] || allFiles['main.css'] || allFiles['style.css'];
    if (cssFile) {
      const cssContent = typeof cssFile.content === 'string' ? cssFile.content : String(cssFile.content || '');
      const cssInjection = `<style>\n${cssContent}\n</style>`;
      
      // Try to inject before closing head tag
      if (modifiedHTML.includes('</head>')) {
        modifiedHTML = modifiedHTML.replace('</head>', cssInjection + '\n</head>');
      } else {
        // If no head tag, add it
        modifiedHTML = modifiedHTML.replace('<html>', '<html><head>' + cssInjection + '</head>');
      }
    }
    
    // Inject JavaScript
    const jsFile = allFiles['script.js'] || allFiles['main.js'] || allFiles['app.js'];
    if (jsFile) {
      const jsContent = typeof jsFile.content === 'string' ? jsFile.content : String(jsFile.content || '');
      const jsInjection = `<script>\n${jsContent}\n</script>`;
      
      // Try to inject before closing body tag
      if (modifiedHTML.includes('</body>')) {
        modifiedHTML = modifiedHTML.replace('</body>', jsInjection + '\n</body>');
      } else {
        // If no body tag, add at the end
        modifiedHTML += jsInjection;
      }
    }
    
    // Return the complete HTML document directly
    console.log('Returning complete HTML document');
    return modifiedHTML;
  }
  
  // If it's just HTML fragments, extract and wrap
  console.log('HTML fragment detected - extracting content');
  let contentToRender = htmlContent;
  
  // Extract the body content from the HTML
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    contentToRender = bodyMatch[1];
  } else {
    // Try to extract main content sections
    const mainMatch = htmlContent.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                     htmlContent.match(/<div[^>]*class="[^"]*main[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                     htmlContent.match(/<div[^>]*id="[^"]*main[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    if (mainMatch) {
      contentToRender = mainMatch[1];
    }
  }
  
  // Extract CSS if it's in a separate file
  const cssFile = allFiles['styles.css'] || allFiles['main.css'] || allFiles['style.css'];
  let additionalCSS = '';
  
  if (cssFile) {
    const cssContent = typeof cssFile.content === 'string' ? cssFile.content : String(cssFile.content || '');
    additionalCSS = `<style>${cssContent}</style>`;
  }
  
  // Extract JavaScript if it's in a separate file
  const jsFile = allFiles['script.js'] || allFiles['main.js'] || allFiles['app.js'];
  let additionalJS = '';
  
  if (jsFile) {
    const jsContent = typeof jsFile.content === 'string' ? jsFile.content : String(jsFile.content || '');
    additionalJS = `<script>${jsContent}</script>`;
  }
  
  return generatePreviewHTML(contentToRender + additionalCSS + additionalJS, allFiles, 'HTML Website');
};

const generateComponentPreview = (componentFile: any, allFiles: Record<string, any>, componentName: string) => {
  // Ensure componentFile has content and handle type safety
  const componentContent = typeof componentFile.content === 'string' ? componentFile.content : String(componentFile.content || '');
  console.log(`${componentName} content preview (first 400 chars):`, componentContent.slice(0, 400));
  
  // Parse the component to extract JSX content with multiple patterns
  const jsxMatches = [
    // Standard return with parentheses
    componentContent.match(/return\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*}?\s*$/m),
    // Return with parentheses but no closing
    componentContent.match(/return\s*\(\s*([\s\S]*?)\s*\)\s*;/),
    // Direct return without parentheses
    componentContent.match(/return\s+(<[\s\S]*?>[\s\S]*?<\/[\s\S]*?>)\s*;?\s*}?\s*$/m),
    // Return statement anywhere in the component
    componentContent.match(/return\s*\(([\s\S]*?)\)\s*;/),
    // JSX fragment or single element
    componentContent.match(/return\s*(<[\s\S]*?>[\s\S]*?<\/[^>]*?>)/),
  ];
  
  console.log('Trying JSX patterns...');
  jsxMatches.forEach((match, i) => {
    if (match) {
      console.log(`Pattern ${i} found:`, match[1]?.slice(0, 100));
    }
  });
  
  const jsxMatch = jsxMatches.find(match => match && match[1] && match[1].trim());
  
  if (!jsxMatch) {
    console.log('No JSX content found with any pattern, showing code preview');
    console.log('Full component content:', componentContent);
    return generateCodePreview(allFiles);
  }

  // Extract the JSX and convert to HTML
  let jsx = jsxMatch[1].trim();
  
  // Clean up the JSX - remove trailing characters that aren't part of JSX
  jsx = jsx.replace(/\s*}\s*$/, ''); // Remove trailing }
  jsx = jsx.replace(/\s*;\s*$/, ''); // Remove trailing ;
  
  console.log('Extracted JSX (first 400 chars):', jsx.slice(0, 400));
  
  // If we still have no meaningful JSX, try a simpler approach
  if (!jsx.includes('<') || jsx.length < 10) {
    console.log('JSX seems invalid, trying alternative extraction...');
    // Try to find any JSX-like content
    const simpleMatch = componentContent.match(/<[\s\S]*?>/);
    if (simpleMatch) {
      jsx = simpleMatch[0];
      console.log('Found simple JSX:', jsx);
    } else {
      return generateCodePreview(allFiles);
    }
  }
  
  const html = convertJSXToHTML(jsx);
  console.log('Converted HTML:', html.slice(0, 200));
  
  // If HTML is too short or doesn't seem like valid content, show debug info
  if (!html || html.length < 10 || !html.includes('<')) {
    console.warn('Generated HTML seems invalid:', html);
    const debugContent = `
      <div style="padding: 20px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;">
        <h3>🔍 Debug Information</h3>
        <p><strong>Component:</strong> ${componentName}</p>
        <p><strong>Extracted JSX:</strong></p>
        <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto;">${jsx}</pre>
        <p><strong>Converted HTML:</strong></p>
        <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto;">${html}</pre>
      </div>
    `;
    return generatePreviewHTML(debugContent, allFiles, componentName + ' (Debug)');
  }
  
  return generatePreviewHTML(html, allFiles, componentName);
};

const convertJSXToHTML = (jsx: string): string => {
  // Simple JSX to HTML conversion
  let html = jsx;
  
  // Convert className to class
  html = html.replace(/className=/g, 'class=');
  
  // Convert self-closing tags
  html = html.replace(/<(\w+)([^>]*?)\s*\/>/g, '<$1$2></$1>');
  
  // Handle JSX expressions - keep simple strings, evaluate basic expressions
  html = html.replace(/\{[^}]*\}/g, (match) => {
    // Keep simple text content, remove complex expressions
    if (match.match(/^{\s*['"`][^'"`]*['"`]\s*}$/)) {
      return match.slice(2, -2); // Remove { and }
    }
    // Handle simple variable interpolations like {title}
    if (match.match(/^{\s*\w+\s*}$/)) {
      const variable = match.slice(1, -1).trim();
      // Return placeholder for variables
      return `[${variable}]`;
    }
    return '';
  });
  
  // Convert style objects to inline styles
  html = html.replace(/style=\{([^}]+)\}/g, (match, styleObj) => {
    // Simple style object parsing - for basic cases
    try {
      const cleaned = styleObj.replace(/\{|\}/g, '').replace(/'/g, '"');
      const styles = cleaned.split(',').map(s => {
        const [key, value] = s.split(':').map(p => p.trim().replace(/"/g, ''));
        if (key && value) {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          return `${cssKey}: ${value}`;
        }
        return '';
      }).filter(Boolean).join('; ');
      
      return `style="${styles}"`;
    } catch {
      return 'style=""';
    }
  });
  
  // Clean up extra whitespace
  html = html.replace(/\s+/g, ' ').trim();
  
  return html;
};

const generatePreviewHTML = (content: string, files: Record<string, any>, componentName: string = 'React App'): string => {
  // For clean preview mode - just show the content without meta information
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Live Preview</title>
      <style>
        /* Reset and base styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          margin: 0;
          padding: 0;
          background: white;
          line-height: 1.6;
          color: #333;
        }
        /* Common utility classes */
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .mt-4 { margin-top: 1rem; }
        .mb-4 { margin-bottom: 1rem; }
        .p-4 { padding: 1rem; }
        .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .grid { display: grid; }
        .gap-4 { gap: 1rem; }
        .w-full { width: 100%; }
        .h-full { height: 100%; }
        .min-h-screen { min-height: 100vh; }
        .bg-white { background-color: white; }
        .bg-gray-100 { background-color: #f3f4f6; }
        .bg-blue-500 { background-color: #3b82f6; }
        .text-white { color: white; }
        .text-gray-600 { color: #6b7280; }
        .rounded { border-radius: 0.375rem; }
        .rounded-lg { border-radius: 0.5rem; }
        .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
        .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
        /* Enhanced styles for better component rendering */
        h1, h2, h3 {
          margin-top: 0;
        }
        button {
          background: #3b82f6;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        button:hover {
          background: #2563eb;
        }
        input, textarea {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
        }
        ul, ol {
          padding-left: 20px;
        }
        a {
          color: #3b82f6;
          text-decoration: underline;
        }
        a:hover {
          color: #2563eb;
        }
        /* Remove any unwanted margins/padding from the preview */
        .preview-content {
          width: 100%;
          height: 100vh;
        }
        /* Debug toggle */
        .debug-toggle {
          position: fixed;
          top: 10px;
          right: 10px;
          background: rgba(0,0,0,0.8);
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          z-index: 1000;
        }
        .debug-panel {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 200px;
          background: #1a1a1a;
          color: #00ff00;
          font-family: monospace;
          font-size: 11px;
          padding: 10px;
          overflow-y: auto;
          z-index: 999;
          border-top: 1px solid #333;
        }
        .debug-panel.show {
          display: block;
        }
      </style>
    </head>
    <body>
      <button class="debug-toggle" onclick="toggleDebug()">🔍 Debug</button>
      <div id="debugPanel" class="debug-panel">
        <strong>Generated Files:</strong><br>
        ${Object.entries(files || {}).map(([path, file]) => {
          const content = typeof file?.content === 'string' ? file.content : String(file?.content || '');
          return `<strong>${path}</strong> (${content.length} chars)<br><pre style="margin: 5px 0; white-space: pre-wrap;">${content.slice(0, 200)}${content.length > 200 ? '...' : ''}</pre>`;
        }).join('<br>')}
      </div>
      
      <div class="preview-content">
        ${content || '<div style="text-align: center; padding: 40px; color: #666; border: 2px solid red;"><h3>⚠️ NO CONTENT RENDERED</h3><p>The website content could not be processed.</p><p>Check the debug panel for details.</p></div>'}
      </div>
      
      <script>
        function toggleDebug() {
          const panel = document.getElementById('debugPanel');
          panel.classList.toggle('show');
        }
        
        // Auto-show debug if no content
        if (!document.querySelector('.preview-content').innerHTML.includes('border: 2px solid red') === false) {
          document.getElementById('debugPanel').classList.add('show');
        }
      </script>
    </body>
    </html>
  `;
};

const generateCodePreview = (files: Record<string, any>): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Generated Code Preview</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { 
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          margin: 0;
          padding: 20px;
          background: #1e293b;
          color: #e2e8f0;
        }
        .code-container {
          max-width: 1200px;
          margin: 0 auto;
          background: #0f172a;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #334155;
        }
        .code-header {
          background: #1e293b;
          padding: 15px 20px;
          border-bottom: 1px solid #334155;
        }
        .file-tab {
          display: inline-block;
          padding: 8px 16px;
          margin-right: 5px;
          background: #374151;
          border-radius: 6px 6px 0 0;
          font-size: 12px;
          color: #d1d5db;
        }
        .code-content {
          padding: 0;
        }
        .file-section {
          border-bottom: 1px solid #334155;
        }
        .file-header {
          background: #374151;
          padding: 10px 20px;
          font-size: 13px;
          color: #9ca3af;
        }
        .file-content {
          padding: 20px;
          overflow-x: auto;
        }
        pre {
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
          color: #e2e8f0;
        }
      </style>
    </head>
    <body>
      <div class="code-container">
        <div class="code-header">
          <h2 style="margin: 0; color: #f1f5f9;">🧠 Generated Code Files</h2>
          <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 14px;">
            ${Object.keys(files).length} files generated by AI agents
          </p>
        </div>
        
        <div class="code-content">
          ${Object.entries(files).map(([path, file]) => {
            const content = typeof file.content === 'string' ? file.content : String(file.content || '');
            return `
            <div class="file-section">
              <div class="file-header">
                ${getFileIcon(path)} ${path}
              </div>
              <div class="file-content">
                <pre><code>${escapeHtml(content)}</code></pre>
              </div>
            </div>
          `;
          }).join('')}
        </div>
      </div>
    </body>
    </html>
  `;
};

const generateNoContentPreview = (): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Waiting for Content</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 flex items-center justify-center min-h-screen">
      <div class="text-center p-8 bg-white rounded-lg shadow-lg max-w-md mx-auto">
        <div class="text-6xl mb-4">🧠</div>
        <h2 class="text-xl font-semibold text-gray-800 mb-2">
          Waiting for AI Agents
        </h2>
        <p class="text-gray-600 mb-4">
          Generated files will appear here as agents create them
        </p>
        <div class="flex justify-center space-x-1">
          <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
          <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getFileIcon = (path: string): string => {
  if (path.includes('.tsx') || path.includes('.jsx')) return '⚛️';
  if (path.includes('.ts') || path.includes('.js')) return '📜';
  if (path.includes('.css')) return '🎨';
  if (path.includes('.json')) return '📋';
  if (path.includes('.html')) return '🌐';
  return '📄';
};

const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};