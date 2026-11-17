"""Conservative, transparent local parsing. Users review all extracted fields."""

import re
import unicodedata

from .document_schemas import PreparationInput, PreparationResult, ReviewedJD, ReviewedResume

# Canonical names map to spelling variants, not inferred equivalences. For example,
# Java != JavaScript, SQL != MySQL, and React != React Native.
SKILLS = {
    "Python": ["python"], "Java": ["java"], "JavaScript": ["javascript", "js"],
    "TypeScript": ["typescript", "ts"], "C++": ["c++", "cpp"], "C#": ["c#", "csharp"],
    "C": ["c"], "Go": ["golang"], "Rust": ["rust"], "Kotlin": ["kotlin"],
    "Swift": ["swift"], "PHP": ["php"], "Ruby": ["ruby"], "Dart": ["dart"],
    "SQL": ["sql", "structured query language"], "HTML": ["html", "html5"],
    "CSS": ["css", "css3"], "React": ["react", "react.js", "reactjs"],
    "Angular": ["angular", "angularjs"], "Vue": ["vue", "vue.js", "vuejs"],
    "Node.js": ["node.js", "nodejs", "node js"], "Express": ["express", "express.js", "expressjs"],
    "FastAPI": ["fastapi", "fast api"], "Django": ["django"], "Flask": ["flask"],
    "Spring Boot": ["spring boot", "springboot"], "Next.js": ["next.js", "nextjs"],
    "Tailwind CSS": ["tailwind", "tailwind css"], "Bootstrap": ["bootstrap"],
    "MongoDB": ["mongodb", "mongo db"], "MySQL": ["mysql"],
    "PostgreSQL": ["postgresql", "postgres"], "SQLite": ["sqlite"], "Redis": ["redis"],
    "Git": ["git"], "GitHub": ["github"], "Docker": ["docker"], "Kubernetes": ["kubernetes", "k8s"],
    "AWS": ["aws", "amazon web services"], "Azure": ["azure"],
    "Google Cloud": ["google cloud", "gcp"], "Linux": ["linux"],
    "REST APIs": ["rest api", "rest apis", "restful", "restful api"], "GraphQL": ["graphql"],
    "Machine Learning": ["machine learning"], "Deep Learning": ["deep learning"],
    "NLP": ["nlp", "natural language processing"], "Pandas": ["pandas"], "NumPy": ["numpy"],
    "TensorFlow": ["tensorflow"], "PyTorch": ["pytorch"], "Scikit-learn": ["scikit-learn", "sklearn"],
    "Power BI": ["power bi", "powerbi"], "Excel": ["excel"], "Tableau": ["tableau"],
    "Data Structures": ["data structures", "data structure"], "Algorithms": ["algorithms"],
    "OOP": ["oop", "object oriented programming", "object-oriented programming"],
    "Testing": ["unit testing", "software testing", "automated testing"],
    "Agile": ["agile"], "Scrum": ["scrum"], "CI/CD": ["ci/cd", "ci cd"],
    "Communication": ["communication", "communication skills"],
    "Teamwork": ["teamwork", "team work", "team collaboration"],
    "Leadership": ["leadership"], "Problem Solving": ["problem solving", "problem-solving"],
    "Time Management": ["time management"], "Adaptability": ["adaptability"],
}


def normalized(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


ALIASES = {normalized(alias): name for name, aliases in SKILLS.items() for alias in [name, *aliases]}


def canonical(value: str) -> str:
    return ALIASES.get(normalized(value), normalized(value))


def unique(values: list[str]) -> list[str]:
    result, seen = [], set()
    for value in values:
        key = canonical(value)
        if key not in seen:
            result.append(value)
            seen.add(key)
    return result


def extract_skills(text: str) -> list[str]:
    text = normalized(text)
    found = []
    for name, aliases in SKILLS.items():
        for alias in sorted(set([name, *aliases]), key=len, reverse=True):
            pattern = r"(?<![\w+#])" + re.escape(normalized(alias)) + r"(?![\w+#])"
            if re.search(pattern, text):
                found.append(name)
                break
    return found


SECTION_NAMES = {
    "projects": ["projects", "project", "academic projects", "personal projects", "key projects", "project experience"],
    "education": ["education", "academic qualifications", "academic background", "qualifications", "educational qualifications"],
    "experience": ["experience", "work experience", "professional experience", "internships", "internship", "employment", "internship experience"],
    "other": ["skills", "technical skills", "technical proficiency", "summary", "professional summary", "objective", "career objective", "certifications", "certificates", "achievements", "awards", "interests", "languages", "activities", "references", "contact", "soft skills", "positions of responsibility"],
}
HEADINGS = {name: section for section, names in SECTION_NAMES.items() for name in names}


def section_key(line: str) -> str | None:
    return HEADINGS.get(normalized(line.strip(" :|-•\t")))


def extract_resume(text: str) -> tuple[ReviewedResume, list[str]]:
    sections = {"projects": [], "education": [], "experience": []}
    current = "other"
    omitted_entries = False
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines:
        # Accept both "Skills" and "Skills: Python, SQL" heading styles.
        prefix, separator, remainder = line.partition(":")
        key = section_key(prefix if separator else line)
        if key:
            current = key
            if not separator or not remainder.strip():
                continue
            line = remainder.strip()
        if current in sections:
            clean = line.lstrip("•●▪–- ").strip()
            if clean and len(clean) <= 2000 and len(sections[current]) < 60:
                sections[current].append(clean)
            elif clean:
                omitted_entries = True
    warnings = ["Local rules suggest fields from text and section headings. Review skills and entries; layout, uncommon skills and context can be missed."]
    if omitted_entries:
        warnings.append("Some section entries exceeded the review limits (60 entries per section, 2,000 characters per entry). Consult the extracted text and summarize them manually.")
    for section, entries in sections.items():
        if not entries:
            warnings.append(f"No {section} section was recognized. You can add it manually.")
    skills = extract_skills(text)
    if not skills:
        warnings.append("No known skill names were recognized. Add your skills manually.")
    profile = ReviewedResume(skills=skills, **{k: unique(v) for k, v in sections.items()})
    return profile, warnings


def extract_jd(text: str) -> tuple[ReviewedJD, list[str]]:
    skills = extract_skills(text)
    warnings = ["Suggested skills come from keyword matching, including preferred or negated mentions. Review which skills are actually required; add missing requirements."]
    if not skills:
        warnings.append("No known skills were recognized. Add the job's requirements manually.")
    return ReviewedJD(text=text, required_skills=skills), warnings


def compare_profiles(data: PreparationInput) -> PreparationResult:
    resume = data.resume_profile.model_copy(deep=True)
    resume.skills = unique(resume.skills)
    jd = data.job_description.model_copy(deep=True)
    jd.required_skills = unique(jd.required_skills)
    present = {canonical(skill) for skill in resume.skills}
    matched = [skill for skill in jd.required_skills if canonical(skill) in present]
    gaps = [skill for skill in jd.required_skills if canonical(skill) not in present]
    return PreparationResult(resume_profile=resume, job_description=jd, matched_skills=matched, skill_gaps=gaps)
