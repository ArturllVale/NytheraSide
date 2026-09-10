const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function recover() {
    const subagentTranscript = 'C:\\Users\\Vale\\.gemini\\antigravity\\brain\\3dfb4766-2306-4475-a678-66f4831a80dc\\.system_generated\\logs\\transcript_full.jsonl';
    const currentTranscript = 'C:\\Users\\Vale\\.gemini\\antigravity\\brain\\b92a1635-434b-43e0-8d8c-79e3515288de\\.system_generated\\logs\\transcript_full.jsonl';
    
    // 1. Recover from subagent view_file
    const stream1 = fs.createReadStream(subagentTranscript);
    const rl1 = readline.createInterface({ input: stream1, crlfDelay: Infinity });

    for await (const line of rl1) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        if (entry.type === 'TOOL_RESPONSE' && entry.tool_responses) {
            for (const tr of entry.tool_responses) {
                if ((tr.name === 'view_file' || tr.name === 'default_api:view_file') && tr.response && tr.response.output) {
                    const output = tr.response.output;
                    const pathMatch = output.match(/File Path: `file:\/\/\/(.+?)`/);
                    if (pathMatch) {
                        let filePath = pathMatch[1].replace(/%3A/i, ':');
                        filePath = filePath.replace(/\/apps\/server\//g, '/server/');
                        filePath = filePath.split('/').join('\\');

                        const lines = output.split('\n');
                        let contentLines = [];
                        let isContent = false;
                        for (let l of lines) {
                            if (l.startsWith('The following code has been modified')) {
                                isContent = true;
                                continue;
                            }
                            if (l.startsWith('The above content')) {
                                isContent = false;
                                continue;
                            }
                            if (isContent) {
                                const match = l.match(/^\d+:\s?(.*)$/);
                                if (match) {
                                    contentLines.push(match[1]);
                                }
                            }
                        }
                        
                        const content = contentLines.join('\n');
                        if (content.trim()) {
                            fs.mkdirSync(path.dirname(filePath), { recursive: true });
                            fs.writeFileSync(filePath, content, 'utf8');
                            console.log('Recovered from subagent:', filePath);
                        }
                    }
                }
            }
        }
    }

    // 2. Recover from current session write_to_file calls
    const stream2 = fs.createReadStream(currentTranscript);
    const rl2 = readline.createInterface({ input: stream2, crlfDelay: Infinity });
    for await (const line of rl2) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        if (entry.type === 'PLANNER_RESPONSE' && entry.tool_calls) {
            for (const tc of entry.tool_calls) {
                if ((tc.name === 'write_to_file' || tc.name === 'default_api:write_to_file') && tc.args && tc.args.TargetFile && tc.args.CodeContent) {
                    let filePath = tc.args.TargetFile;
                    filePath = filePath.replace(/\\apps\\server\\/g, '\\server\\');
                    fs.mkdirSync(path.dirname(filePath), { recursive: true });
                    fs.writeFileSync(filePath, tc.args.CodeContent, 'utf8');
                    console.log('Recovered from current session:', filePath);
                }
            }
        }
    }
}

recover().catch(console.error);