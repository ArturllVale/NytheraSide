const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function recover() {
    const subagentTranscript = 'C:\\Users\\Vale\\.gemini\\antigravity\\brain\\3dfb4766-2306-4475-a678-66f4831a80dc\\.system_generated\\logs\\transcript_full.jsonl';
    
    // 1. Recover from subagent view_file outputs
    const stream1 = fs.createReadStream(subagentTranscript);
    const rl1 = readline.createInterface({ input: stream1, crlfDelay: Infinity });

    for await (const line of rl1) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        // Look for the text content containing "File Path: `file://..."
        let contentStr = '';
        if (entry.content) contentStr = entry.content;
        else if (entry.tool_responses) {
            for (const tr of entry.tool_responses) {
                if (tr.response && tr.response.output) contentStr += '\n' + tr.response.output;
            }
        }
        
        if (contentStr.includes('File Path: `file:///')) {
            const pathMatch = contentStr.match(/File Path: `file:\/\/\/(.+?)`/);
            if (pathMatch) {
                let filePath = pathMatch[1].replace(/%3A/i, ':');
                filePath = filePath.replace(/\/apps\/server\//g, '/server/');
                filePath = filePath.split('/').join('\\');

                const lines = contentStr.split('\n');
                let contentLines = [];
                let isContent = false;
                for (let l of lines) {
                    if (l.startsWith('The following code has been modified')) {
                        isContent = true;
                        continue;
                    }
                    if (l.startsWith('The above content')) {
                        isContent = false;
                        break;
                    }
                    if (isContent) {
                        const match = l.match(/^\d+:\s?(.*)$/);
                        if (match) {
                            contentLines.push(match[1]);
                        } else {
                            // Empty line or misparsed
                            if (l.match(/^\d+:/)) contentLines.push('');
                            else contentLines.push(l); 
                        }
                    }
                }
                
                const content = contentLines.join('\n');
                if (content.trim() && contentLines.length > 0) {
                    fs.mkdirSync(path.dirname(filePath), { recursive: true });
                    fs.writeFileSync(filePath, content, 'utf8');
                    console.log('Recovered from subagent:', filePath);
                }
            }
        }
    }
}

recover().catch(console.error);