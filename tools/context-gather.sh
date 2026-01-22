#!/bin/bash

# Context Gather - RidgeTop AI Alpha
# Purpose: Gather relevant context from codebase + Mandrel for AI task execution
# Instance 05 build - testing workflow hypothesis

set -e

# Configuration
MANDREL_HOST="hetzner"
MANDREL_URL="http://localhost:8080/mcp/tools"
OUTPUT_FORMAT="markdown"
MAX_FILE_SIZE=50000  # Characters per file
MAX_TOTAL_SIZE=150000  # Total context budget

# Colors for terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Help text
show_help() {
    echo "Context Gather - Collect relevant context for AI task execution"
    echo ""
    echo "Usage: context-gather.sh [OPTIONS] <task-description>"
    echo ""
    echo "Options:"
    echo "  -p, --project <path>    Project directory to scan (default: current dir)"
    echo "  -e, --entities <list>   Comma-separated entities to search for"
    echo "  -m, --mandrel           Include Mandrel context search"
    echo "  -t, --tests             Include test files"
    echo "  -v, --verbose           Show file sizes and detailed info"
    echo "  -o, --output <file>     Output to file instead of stdout"
    echo "  -h, --help              Show this help"
    echo ""
    echo "Examples:"
    echo "  context-gather.sh \"Add user preferences API endpoint\""
    echo "  context-gather.sh -p ~/projects/myapp -e user,preferences,api \"Add preferences\""
    echo "  context-gather.sh -m \"Refactor authentication logic\""
}

# Extract likely entities from task description
extract_entities() {
    local task="$1"

    # Convert to lowercase, extract words that look like code entities
    # Filter common words, keep nouns that might be code entities
    echo "$task" | \
        tr '[:upper:]' '[:lower:]' | \
        tr -cs '[:alnum:]' '\n' | \
        grep -vE '^(the|a|an|to|for|of|in|on|with|and|or|is|are|be|been|was|were|have|has|had|do|does|did|will|would|could|should|may|might|must|shall|can|need|want|add|create|make|build|fix|update|remove|delete|get|set|implement|refactor|change|modify)$' | \
        grep -E '^[a-z]{3,}$' | \
        sort -u | \
        head -10
}

# Find relevant files based on entities
find_relevant_files() {
    local project_dir="$1"
    local entities="$2"
    local include_tests="$3"

    local patterns=""

    for entity in $(echo "$entities" | tr ',' '\n'); do
        # Match filenames containing entity
        patterns="$patterns -o -iname '*${entity}*'"
    done

    # Remove leading -o
    patterns="${patterns# -o }"

    # Find source files (only actual source, not config or data)
    local find_cmd="find \"$project_dir\" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.py' -o -name '*.go' \)"

    # Exclude common directories and non-source files
    find_cmd="$find_cmd -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/.next/*' -not -path '*/coverage/*' -not -path '*/.surveyor/*' -not -name '*.config.*' -not -name 'vitest.config.*' -not -name 'tailwind.config.*' -not -name 'postcss.config.*' -not -name '*.d.ts'"

    # Exclude test files if not requested
    if [ "$include_tests" != "true" ]; then
        find_cmd="$find_cmd -not -name '*.test.*' -not -name '*.spec.*' -not -path '*/__tests__/*'"
    fi

    # Filter by entity patterns if provided
    if [ -n "$entities" ]; then
        find_cmd="$find_cmd \( $patterns \)"
    fi

    eval "$find_cmd" 2>/dev/null | head -20
}

# Search file contents for entities
search_file_contents() {
    local project_dir="$1"
    local entities="$2"
    local include_tests="$3"

    local exclude_pattern="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build --exclude-dir=.next --exclude-dir=coverage --exclude-dir=.surveyor --exclude=*.config.* --exclude=*.d.ts"

    if [ "$include_tests" != "true" ]; then
        exclude_pattern="$exclude_pattern --exclude=*.test.* --exclude=*.spec.*"
    fi

    for entity in $(echo "$entities" | tr ',' '\n'); do
        # Search for class/function/type definitions
        grep -rl $exclude_pattern -E "(class|function|type|interface|const|export)\s+\w*${entity}\w*" "$project_dir" 2>/dev/null | head -10
    done | sort -u | head -15
}

# Get Mandrel context for project
get_mandrel_context() {
    local search_query="$1"

    echo -e "${BLUE}Fetching Mandrel context...${NC}" >&2

    # Search Mandrel for relevant context
    local result=$(ssh "$MANDREL_HOST" "curl -s -X POST $MANDREL_URL/context_search -H 'Content-Type: application/json' -d '{\"arguments\": {\"query\": \"$search_query\", \"limit\": 3}}'")

    # Also get recent context
    local recent=$(ssh "$MANDREL_HOST" "curl -s -X POST $MANDREL_URL/context_get_recent -H 'Content-Type: application/json' -d '{\"arguments\": {\"limit\": 3}}'")

    echo "SEARCH_RESULT:$result"
    echo "RECENT_RESULT:$recent"
}

# Format file content for output
format_file() {
    local filepath="$1"
    local max_size="$2"
    local show_verbose="$3"

    if [ ! -f "$filepath" ]; then
        return
    fi

    local size=$(wc -c < "$filepath")
    local lines=$(wc -l < "$filepath")
    local content

    if [ "$size" -gt "$max_size" ]; then
        content=$(head -c "$max_size" "$filepath")
        content="$content\n\n... [TRUNCATED - file too large] ..."
    else
        content=$(cat "$filepath")
    fi

    echo "### File: $filepath"
    if [ "$show_verbose" == "true" ]; then
        echo ""
        echo "*Size: $size bytes | Lines: $lines*"
    fi
    echo ""
    echo '```'
    echo "$content"
    echo '```'
    echo ""
}

# Main function
main() {
    local project_dir="."
    local entities=""
    local include_mandrel="false"
    local include_tests="false"
    local verbose="false"
    local output_file=""
    local task=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--project)
                project_dir="$2"
                shift 2
                ;;
            -e|--entities)
                entities="$2"
                shift 2
                ;;
            -m|--mandrel)
                include_mandrel="true"
                shift
                ;;
            -t|--tests)
                include_tests="true"
                shift
                ;;
            -v|--verbose)
                verbose="true"
                shift
                ;;
            -o|--output)
                output_file="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                if [ -z "$task" ]; then
                    task="$1"
                fi
                shift
                ;;
        esac
    done

    # Validate inputs
    if [ -z "$task" ]; then
        echo -e "${RED}Error: Task description required${NC}" >&2
        show_help
        exit 1
    fi

    if [ ! -d "$project_dir" ]; then
        echo -e "${RED}Error: Project directory not found: $project_dir${NC}" >&2
        exit 1
    fi

    # Extract entities if not provided
    if [ -z "$entities" ]; then
        entities=$(extract_entities "$task" | tr '\n' ',' | sed 's/,$//')
    fi

    echo -e "${GREEN}=== Context Gather ===${NC}" >&2
    echo -e "${YELLOW}Task:${NC} $task" >&2
    echo -e "${YELLOW}Project:${NC} $project_dir" >&2
    echo -e "${YELLOW}Entities:${NC} $entities" >&2
    echo "" >&2

    # Start building output
    local output=""
    local total_size=0

    output+="# Context for Task\n\n"
    output+="**Task:** $task\n\n"
    output+="**Project:** $project_dir\n\n"
    output+="**Identified Entities:** $entities\n\n"
    output+="---\n\n"

    # Find relevant files
    echo -e "${BLUE}Finding relevant files...${NC}" >&2

    local files_by_name=$(find_relevant_files "$project_dir" "$entities" "$include_tests")
    local files_by_content=$(search_file_contents "$project_dir" "$entities" "$include_tests")

    # Combine and deduplicate
    local all_files=$(echo -e "$files_by_name\n$files_by_content" | sort -u | grep -v '^$')
    local file_count=$(echo "$all_files" | wc -l)

    echo -e "${GREEN}Found $file_count relevant files${NC}" >&2

    # Show file list in verbose mode
    if [ "$verbose" == "true" ]; then
        echo -e "${BLUE}Files to include:${NC}" >&2
        for f in $all_files; do
            local fsize=$(wc -c < "$f" 2>/dev/null || echo "0")
            echo -e "  - $f (${fsize} bytes)" >&2
        done
        echo "" >&2
    fi

    # Add code context section
    output+="## Code Context\n\n"

    for filepath in $all_files; do
        if [ "$total_size" -gt "$MAX_TOTAL_SIZE" ]; then
            output+="\n*[Context budget reached - additional files omitted]*\n"
            break
        fi

        local file_content=$(format_file "$filepath" "$MAX_FILE_SIZE" "$verbose")
        local file_size=${#file_content}

        if [ $((total_size + file_size)) -lt "$MAX_TOTAL_SIZE" ]; then
            output+="$file_content\n"
            total_size=$((total_size + file_size))
        fi
    done

    # Add Mandrel context if requested
    if [ "$include_mandrel" == "true" ]; then
        output+="\n---\n\n## Mandrel Project Context\n\n"

        local mandrel_result=$(get_mandrel_context "$task")

        # Extract and format content blocks using jq-style parsing
        # This is a simplified approach - extracts Content: lines from the text output
        local search_content=$(echo "$mandrel_result" | grep "SEARCH_RESULT:" | sed 's/SEARCH_RESULT://' | grep -oE 'Content: [^\\]+' | head -3)
        local recent_content=$(echo "$mandrel_result" | grep "RECENT_RESULT:" | sed 's/RECENT_RESULT://' | grep -oE 'Content: [^\\]+' | head -3)

        if [ -n "$search_content" ] || [ -n "$recent_content" ]; then
            if [ -n "$search_content" ]; then
                output+="### Semantic Search Results\n\n"
                output+="$search_content\n\n"
            fi
            if [ -n "$recent_content" ]; then
                output+="### Recent Project Context\n\n"
                output+="$recent_content\n\n"
            fi
        else
            output+="*No relevant Mandrel context found*\n"
        fi
    fi

    # Add footer
    output+="\n---\n\n"
    output+="**Context gathered:** $(date -Iseconds)\n"
    output+="**Total size:** $total_size characters\n"
    output+="**Files included:** $file_count\n"

    # Output results
    if [ -n "$output_file" ]; then
        echo -e "$output" > "$output_file"
        echo -e "${GREEN}Context written to: $output_file${NC}" >&2
    else
        echo -e "$output"
    fi
}

# Run main
main "$@"
