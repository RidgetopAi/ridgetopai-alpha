# Bug Fix Workflow Audit - Claude CLI Prompts (Instance 3)

## PROMPT 1: Bug Analysis Prompt
**File:** backend/src/taskRunner.ts:92-144
**Function:** buildBugAnalysisPrompt()

### Template:
```
You are analyzing a bug report for a codebase at: {projectPath}
{mandrelContext - optional previous work from institutional memory}

## Bug Report
**Title:** {title}
**Description:** {description}
**Severity:** {severity}
**Steps to Reproduce:** {stepsToReproduce - optional}
**Expected Behavior:** {expectedBehavior - optional}
**Actual Behavior:** {actualBehavior - optional}

## Your Task
1. Analyze this bug report and identify the likely root cause
2. Search the codebase to find relevant files and evidence
3. Propose a fix with specific code changes

## Output Format
JSON object with:
- rootCause: string
- evidence: string
- confidence: high|medium|low
- questions: string[] (optional)
- proposedFix: {
    explanation: string,
    changes: [{file, original, proposed, explanation}],
    risks: string[],
    testNeeds: string[]
  }
```

### Key Observations:
1. **Mandrel Context Injection** - Prior work is injected at line 93-94
2. **Structured JSON Output** - Forces JSON format with backticks
3. **Minimal/Surgical Changes** - Explicit instruction to keep changes small
4. **Confidence Levels** - Must express uncertainty (high/medium/low)

---

## PROMPT 2: Implementation Prompt
**File:** backend/src/taskRunner.ts:341-404
**Function:** buildImplementationPrompt()

### Template:
```
You are implementing approved code changes for a codebase at: {projectPath}

## Approved Changes
{For each change: file, original code, proposed code, rationale}

## Your Task
1. Apply each change to the specified file
2. Make ONLY the approved changes - do not modify anything else
3. Run the build to verify the code compiles cleanly
4. {Run tests or skip based on runTests flag}
5. Report what was done

## Output Format
JSON object with:
- success: boolean
- changedFiles: string[]
- buildResult: {success, command, output}
- testResults: {passed, failed, skipped, duration, output} (if runTests)
- warnings: string[]
- errors: string[]
```

### Key Observations:
1. **Exact Application** - Instructed to apply changes EXACTLY as specified
2. **No Extra Changes** - Explicitly forbidden from adding improvements
3. **Build Verification** - Must run build after changes
4. **Test Flag** - Can optionally run tests based on runTests parameter
