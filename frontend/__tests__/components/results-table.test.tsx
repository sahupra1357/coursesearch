import { render, screen, fireEvent } from "@testing-library/react"
import { ResultsTable } from "@/components/course-search/results-table"
import type { CollegeResult } from "@/lib/types"

const mockResults: CollegeResult[] = [
  {
    id: "1",
    college: "IIT Bombay",
    course: "B.Tech Computer Science",
    location: "Mumbai",
    isLocal: false,
    isOnline: false,
    ranking: "#1 Engineering — NIRF 2024",
    fees: "₹2.2L/year",
    scholarships: null,
    duration: "4 years",
    admissionRequirements: ["JEE Advanced", "10+2 PCM with 75%"],
    admissionLink: "https://iitb.ac.in/admissions",
    courseLink: "https://iitb.ac.in",
    description: "World-class B.Tech CSE program at IIT Bombay.",
    deadline: "April 2025",
    highlights: ["Algorithms", "Machine Learning", "Systems Design"],
    careerPaths: ["Software Engineer", "Research Scientist"],
    source: "iitb.ac.in",
    score: 0.97,
    foundBy: "RankedCollegesAgent",
  },
  {
    id: "2",
    college: "RVCE Bangalore",
    course: "B.E. Computer Science",
    location: "Bangalore",
    isLocal: true,
    isOnline: false,
    ranking: "NAAC A+",
    fees: "₹1.2L/year",
    scholarships: "Merit scholarship up to 50%",
    duration: "4 years",
    admissionRequirements: ["KCET / COMEDK", "10+2 PCM 60% minimum"],
    admissionLink: null,
    courseLink: "https://rvce.edu.in",
    description: "Premier engineering college in Bangalore.",
    deadline: "June 2025",
    highlights: ["Web Development", "Data Structures"],
    careerPaths: ["Software Developer", "Data Analyst"],
    source: "rvce.edu.in",
    score: 0.88,
    foundBy: "LocalCollegesAgent",
  },
]

describe("ResultsTable", () => {
  it("shows loading indicator when isLoading is true", () => {
    render(
      <ResultsTable
        results={[]}
        isLoading={true}
        hasSearched={true}
        query="python"
      />
    )
    expect(screen.getByText(/Searching for/)).toBeInTheDocument()
    expect(screen.getByText(/4 agents running in parallel/)).toBeInTheDocument()
  })

  it("shows search prompt when hasSearched is false", () => {
    render(
      <ResultsTable
        results={[]}
        isLoading={false}
        hasSearched={false}
        query=""
      />
    )
    expect(screen.getByText("Find the right course")).toBeInTheDocument()
  })

  it("shows no-results message when searched but empty", () => {
    render(
      <ResultsTable
        results={[]}
        isLoading={false}
        hasSearched={true}
        query="xyznotfound"
      />
    )
    expect(screen.getByText("No results found")).toBeInTheDocument()
  })

  it("renders college names", () => {
    render(
      <ResultsTable
        results={mockResults}
        isLoading={false}
        hasSearched={true}
        query="Computer Science"
      />
    )
    expect(screen.getByText("IIT Bombay")).toBeInTheDocument()
    expect(screen.getByText("RVCE Bangalore")).toBeInTheDocument()
  })

  it("renders fees for each college", () => {
    render(
      <ResultsTable
        results={mockResults}
        isLoading={false}
        hasSearched={true}
        query="Computer Science"
      />
    )
    expect(screen.getByText("₹2.2L/year")).toBeInTheDocument()
    expect(screen.getByText("₹1.2L/year")).toBeInTheDocument()
  })

  it("shows local colleges section when local results present", () => {
    render(
      <ResultsTable
        results={mockResults}
        isLoading={false}
        hasSearched={true}
        query="Computer Science"
      />
    )
    expect(screen.getByText("Colleges Near You")).toBeInTheDocument()
    expect(screen.getByText("Top Colleges Nationally")).toBeInTheDocument()
  })

  it("shows Local badge on local college cards", () => {
    render(
      <ResultsTable
        results={mockResults}
        isLoading={false}
        hasSearched={true}
        query="Computer Science"
      />
    )
    expect(screen.getByText("Local")).toBeInTheDocument()
  })

  it("expands admission requirements on toggle click", () => {
    render(
      <ResultsTable
        results={[mockResults[0]]}
        isLoading={false}
        hasSearched={true}
        query="Computer Science"
      />
    )
    // Requirements are hidden initially
    expect(screen.queryByText("JEE Advanced")).not.toBeInTheDocument()

    // Click the toggle button
    fireEvent.click(screen.getByText("Admission Details"))

    // Requirements should now be visible
    expect(screen.getByText("JEE Advanced")).toBeInTheDocument()
    expect(screen.getByText("10+2 PCM with 75%")).toBeInTheDocument()
  })

  it("shows highlights and career paths after expanding", () => {
    render(
      <ResultsTable
        results={[mockResults[0]]}
        isLoading={false}
        hasSearched={true}
        query="Computer Science"
      />
    )
    fireEvent.click(screen.getByText("Admission Details"))
    expect(screen.getByText("Algorithms")).toBeInTheDocument()
    expect(screen.getByText("Software Engineer")).toBeInTheDocument()
  })

  it("shows Apply Now button when admissionLink is present", () => {
    render(
      <ResultsTable
        results={[mockResults[0]]}
        isLoading={false}
        hasSearched={true}
        query="Computer Science"
      />
    )
    expect(screen.getByText("Apply Now")).toBeInTheDocument()
  })

  it("shows deadline after expanding details", () => {
    render(
      <ResultsTable
        results={[mockResults[0]]}
        isLoading={false}
        hasSearched={true}
        query="Computer Science"
      />
    )
    fireEvent.click(screen.getByText("Admission Details"))
    expect(screen.getByText(/April 2025/)).toBeInTheDocument()
  })
})
