use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCodeSkill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub triggers: Option<Vec<String>>,
    pub role: Option<String>,
    pub scope: Option<String>,
    pub output_format: Option<String>,
    pub version: Option<String>,
    pub language: Option<String>,
    pub framework: Option<String>,
    pub tags: Option<Vec<String>>,
    pub category: Option<String>,
    pub license: Option<String>,
    pub content: String,
    pub has_references: bool,
    pub reference_count: usize,
}

#[derive(Debug, Deserialize)]
struct SkillFrontmatter {
    name: Option<String>,
    description: Option<String>,
    triggers: Option<Vec<String>>,
    role: Option<String>,
    scope: Option<String>,
    #[serde(rename = "output-format")]
    output_format: Option<String>,
    version: Option<String>,
    language: Option<String>,
    framework: Option<String>,
    tags: Option<Vec<String>>,
    category: Option<String>,
    license: Option<String>,
}

/// Get the path to the Claude Code skills directory
fn get_skills_directory() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let skills_path = home.join(".agents").join("skills");
    if skills_path.exists() && skills_path.is_dir() {
        Some(skills_path)
    } else {
        None
    }
}

/// Parse YAML frontmatter from markdown file
fn parse_frontmatter(content: &str) -> Option<(SkillFrontmatter, String)> {
    let lines: Vec<&str> = content.lines().collect();

    // Check if file starts with ---
    if !lines.first()?.trim().eq("---") {
        return None;
    }

    // Find the closing ---
    let end_idx = lines.iter().skip(1).position(|line| line.trim() == "---")?;

    // Extract frontmatter (skip first --- and take until second ---)
    let frontmatter_lines = &lines[1..end_idx + 1];
    let frontmatter_str = frontmatter_lines.join("\n");

    // Parse YAML
    let frontmatter: SkillFrontmatter = serde_yaml::from_str(&frontmatter_str).ok()?;

    // Extract content (everything after second ---)
    let content_lines = &lines[end_idx + 2..];
    let content = content_lines.join("\n");

    Some((frontmatter, content))
}

/// Read a skill directory and parse its SKILL.md file
fn read_skill(skill_dir: &Path) -> Result<ClaudeCodeSkill, String> {
    let skill_md_path = skill_dir.join("SKILL.md");

    if !skill_md_path.exists() {
        return Err(format!("SKILL.md not found in {:?}", skill_dir));
    }

    let content = fs::read_to_string(&skill_md_path)
        .map_err(|e| format!("Failed to read SKILL.md: {}", e))?;

    let (frontmatter, body) = parse_frontmatter(&content)
        .ok_or_else(|| "Failed to parse frontmatter".to_string())?;

    // Get skill ID from directory name
    let skill_id = skill_dir
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid skill directory name".to_string())?
        .to_string();

    // Check for references directory
    let references_dir = skill_dir.join("references");
    let has_references = references_dir.exists() && references_dir.is_dir();
    let reference_count = if has_references {
        fs::read_dir(&references_dir)
            .map(|entries| entries.filter_map(|e| e.ok()).count())
            .unwrap_or(0)
    } else {
        0
    };

    Ok(ClaudeCodeSkill {
        id: skill_id.clone(),
        name: frontmatter.name.unwrap_or(skill_id),
        description: frontmatter.description.unwrap_or_default(),
        triggers: frontmatter.triggers,
        role: frontmatter.role,
        scope: frontmatter.scope,
        output_format: frontmatter.output_format,
        version: frontmatter.version,
        language: frontmatter.language,
        framework: frontmatter.framework,
        tags: frontmatter.tags,
        category: frontmatter.category,
        license: frontmatter.license,
        content: body,
        has_references,
        reference_count,
    })
}

#[tauri::command]
pub fn list_claude_code_skills() -> Result<Vec<ClaudeCodeSkill>, String> {
    let skills_dir = get_skills_directory()
        .ok_or_else(|| "Claude Code skills directory not found (~/.agents/skills/)".to_string())?;

    let mut skills = Vec::new();

    let entries = fs::read_dir(&skills_dir)
        .map_err(|e| format!("Failed to read skills directory: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();

        // Skip if not a directory
        if !path.is_dir() {
            continue;
        }

        // Skip hidden directories
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') {
                continue;
            }
        }

        // Try to read the skill
        match read_skill(&path) {
            Ok(skill) => skills.push(skill),
            Err(e) => {
                eprintln!("Warning: Failed to read skill {:?}: {}", path, e);
                continue;
            }
        }
    }

    // Sort skills by name
    skills.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(skills)
}

#[tauri::command]
pub fn get_claude_code_skill(skill_id: String) -> Result<ClaudeCodeSkill, String> {
    let skills_dir = get_skills_directory()
        .ok_or_else(|| "Claude Code skills directory not found (~/.agents/skills/)".to_string())?;

    let skill_dir = skills_dir.join(&skill_id);

    if !skill_dir.exists() {
        return Err(format!("Skill '{}' not found", skill_id));
    }

    read_skill(&skill_dir)
}

#[tauri::command]
pub fn get_skill_categories() -> Result<HashMap<String, usize>, String> {
    let skills_dir = get_skills_directory()
        .ok_or_else(|| "Claude Code skills directory not found (~/.agents/skills/)".to_string())?;

    let mut categories: HashMap<String, usize> = HashMap::new();

    let entries = fs::read_dir(&skills_dir)
        .map_err(|e| format!("Failed to read skills directory: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        if let Ok(skill) = read_skill(&path) {
            if let Some(category) = skill.category {
                *categories.entry(category).or_insert(0) += 1;
            }
            if let Some(role) = skill.role {
                *categories.entry(format!("role:{}", role)).or_insert(0) += 1;
            }
        }
    }

    Ok(categories)
}
