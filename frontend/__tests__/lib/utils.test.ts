import { cn } from "@/lib/utils"

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible")
  })

  it("resolves tailwind conflicts — last wins", () => {
    expect(cn("p-4", "p-8")).toBe("p-8")
  })

  it("handles empty input", () => {
    expect(cn()).toBe("")
  })

  it("handles undefined and null", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b")
  })
})
