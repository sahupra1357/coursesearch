import { render, screen, fireEvent } from "@testing-library/react"
import { ResultsTable } from "@/components/course-search/results-table"
import type { WebResult } from "@/lib/types"

const mockResults: WebResult[] = [
  {
    id: "1",
    title: "Python Programming Course",
    url: "https://example.com/python",
    source: "example.com",
    snippet: "Learn Python programming from scratch.",
    score: 0.95,
  },
  {
    id: "2",
    title: "Advanced Python Masterclass",
    url: "https://coursera.org/python",
    source: "coursera.org",
    snippet: "Advanced Python topics for experienced developers.",
    score: 0.88,
  },
]

describe("ResultsTable", () => {
  it("shows loading spinner with query text when isLoading is true", () => {
    render(
      <ResultsTable
        results={[]}
        isLoading={true}
        hasSearched={true}
        query="python"
      />
    )
    expect(screen.getByText(/Searching the web/)).toBeInTheDocument()
    expect(screen.getByText(/python/)).toBeInTheDocument()
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
    expect(screen.getByText("Search for a course")).toBeInTheDocument()
    expect(
      screen.getByText(/Enter a course name, skill, or category/)
    ).toBeInTheDocument()
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
    expect(screen.getByText(/Try a different search term/)).toBeInTheDocument()
  })

  it("renders result titles", () => {
    render(
      <ResultsTable
        results={mockResults}
        isLoading={false}
        hasSearched={true}
        query="python"
      />
    )
    // Both desktop and mobile views render same titles, so getAllByText
    expect(
      screen.getAllByText("Python Programming Course").length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText("Advanced Python Masterclass").length
    ).toBeGreaterThan(0)
  })

  it("renders source badges for each result", () => {
    render(
      <ResultsTable
        results={mockResults}
        isLoading={false}
        hasSearched={true}
        query="python"
      />
    )
    expect(screen.getAllByText("example.com").length).toBeGreaterThan(0)
    expect(screen.getAllByText("coursera.org").length).toBeGreaterThan(0)
  })

  it("expands snippet on mobile toggle button click", () => {
    render(
      <ResultsTable
        results={[mockResults[0]]}
        isLoading={false}
        hasSearched={true}
        query="python"
      />
    )
    // Desktop table always renders the snippet (1 occurrence before expand)
    expect(
      screen.getAllByText("Learn Python programming from scratch.").length
    ).toBe(1)

    // Click the toggle button to expand the mobile section
    const buttons = screen.getAllByRole("button")
    fireEvent.click(buttons[0])

    // Now snippet appears in both desktop table and mobile expanded section
    expect(
      screen.getAllByText("Learn Python programming from scratch.").length
    ).toBe(2)
  })
})
