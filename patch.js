const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function applyReplacements() {
    const currentTranscript = 'C:\\Users\\Vale\\.gemini\\antigravity\\brain\\b92a1635-434b-43e0-8d8c-79e3515288de\\.system_generated\\logs\\transcript_full.jsonl';
    
    const stream = fs.createReadStream(currentTranscript);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let applied = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        if (entry.type === 'PLANNER_RESPONSE' && entry.tool_calls) {
            for (const tc of entry.tool_calls) {
                if ((tc.name === 'replace_file_content' || tc.name === 'default_api:replace_file_content') && tc.args && tc.args.TargetFile && tc.args.TargetContent && tc.args.ReplacementContent) {
                    let filePath = tc.args.TargetFile;
                    // Fix paths
                    filePath = filePath.replace(/\\apps\\server\\/g, '\\server\\');
                    
                    if (fs.existsSync(filePath)) {
                        let content = fs.readFileSync(filePath, 'utf8');
                        const target = tc.args.TargetContent;
                        const replacement = tc.args.ReplacementContent;
                        
                        // Normalize line endings for replacement
                        const normalize = (s) => s.replace(/\r\n/g, '\n');
                        const normalizedContent = normalize(content);
                        const normalizedTarget = normalize(target);
                        const normalizedReplacement = normalize(replacement);

                        if (normalizedContent.includes(normalizedTarget)) {
                            content = normalizedContent.replace(normalizedTarget, normalizedReplacement);
                            fs.writeFileSync(filePath, content, 'utf8');
                            console.log('Applied replacement to', filePath);
                            applied++;
                        } else {
                            console.log('Could not find target in', filePath);
                        }
                    }
                }
            }
        }
    }
    console.log('Applied', applied, 'replacements');
}

applyReplacements().catch(console.error);