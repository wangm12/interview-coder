// Solutions.tsx
import React, { useState, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"

import ScreenshotQueue from "../components/Queue/ScreenshotQueue"

import { ProblemStatementData } from "../types/solutions"
import SolutionCommands from "../components/Solutions/SolutionCommands"
import Debug from "./Debug"
import { useToast } from "../contexts/toast"

export const ContentSection = ({
  title,
  content,
  isLoading
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="mt-4 flex">
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Extracting problem statement...
        </p>
      </div>
    ) : (
      <div className="text-[13px] leading-[1.4] text-gray-100 max-w-[600px]">
        {content}
      </div>
    )}
  </div>
)
const SolutionSection = ({
  title,
  content,
  isLoading,
  currentLanguage
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
  currentLanguage: string
}) => {

  return (
    <div className="space-y-2 relative">
      <h2 className="text-[13px] font-medium text-white tracking-wide">
        {title}
      </h2>
      {isLoading ? (
        <div className="space-y-1.5">
          <div className="mt-4 flex">
            <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
              Loading solutions...
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full relative">
          <SyntaxHighlighter
            showLineNumbers
            language={currentLanguage == "golang" ? "go" : currentLanguage}
            style={dracula}
            customStyle={{
              maxWidth: "100%",
              margin: 0,
              padding: "1rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              backgroundColor: "rgba(22, 27, 34, 0.5)"
            }}
            wrapLongLines={true}
          >
            {content as string}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
}

export const ComplexitySection = ({
  timeComplexity,
  spaceComplexity,
  isLoading
}: {
  timeComplexity: string | null
  spaceComplexity: string | null
  isLoading: boolean
}) => {
  // Helper to ensure we have proper complexity values
  const formatComplexity = (complexity: string | null): string => {
    // Default if no complexity returned by LLM
    if (!complexity || complexity.trim() === "") {
      return "Complexity not available";
    }

    const bigORegex = /O\([^)]+\)/i;
    // Return the complexity as is if it already has Big O notation
    if (bigORegex.test(complexity)) {
      return complexity;
    }

    // Concat Big O notation to the complexity
    return `O(${complexity})`;
  };

  const formattedTimeComplexity = formatComplexity(timeComplexity);
  const formattedSpaceComplexity = formatComplexity(spaceComplexity);

  return (
    <div className="space-y-2">
      <h2 className="text-[13px] font-medium text-white tracking-wide">
        Complexity
      </h2>
      {isLoading ? (
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Calculating complexity...
        </p>
      ) : (
        <div className="space-y-3">
          <div className="text-[13px] leading-[1.4] text-gray-100 bg-white/5 rounded-md p-3">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
              <div>
                <strong>Time:</strong> {formattedTimeComplexity}
              </div>
            </div>
          </div>
          <div className="text-[13px] leading-[1.4] text-gray-100 bg-white/5 rounded-md p-3">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
              <div>
                <strong>Space:</strong> {formattedSpaceComplexity}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface SolutionsProps {
  setView: (view: "queue" | "solutions" | "debug") => void
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
}

// Define types for the solution data structure
interface SolutionData {
  code: string;
  thoughts: string[];
  time_complexity: string;
  space_complexity: string;
}

interface DebugData {
  code: string;
  debug_analysis: string;
  thoughts: string[];
  time_complexity: string;
  space_complexity: string;
}

export const Solutions: React.FC<SolutionsProps> = ({
  setView,
  credits,
  currentLanguage,
  setLanguage
}) => {
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  const [debugProcessing, setDebugProcessing] = useState(false)
  const [problemStatementData, setProblemStatementData] =
    useState<ProblemStatementData | null>(null)
  const [solutionData, setSolutionData] = useState<string | null>(null)
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null)
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    null
  )
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    null
  )

  // New state for sequential processing stages
  const [edgeCasesData, setEdgeCasesData] = useState<string[] | null>(null)
  const [pseudoCodeData, setPseudoCodeData] = useState<string | null>(null)
  const [solutionThinkingData, setSolutionThinkingData] = useState<string[] | null>(null)

  // Loading states for different stages
  const [loadingEdgeCases, setLoadingEdgeCases] = useState(false)
  const [loadingSolutionThinking, setLoadingSolutionThinking] = useState(false)
  const [loadingApproach, setLoadingApproach] = useState(false)
  const [loadingCode, setLoadingCode] = useState(false)
  const [loadingComplexity, setLoadingComplexity] = useState(false)

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)

  const [isResetting, setIsResetting] = useState(false)

  interface Screenshot {
    id: string
    path: string
    preview: string
    timestamp: number
  }

  const [extraScreenshots, setExtraScreenshots] = useState<Screenshot[]>([])

  useEffect(() => {
    const fetchScreenshots = async () => {
      try {
        const existing = await window.electronAPI.getScreenshots()
        console.log("Raw screenshot data:", existing)
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now()
          })
        )
        console.log("Processed screenshots:", screenshots)
        setExtraScreenshots(screenshots)
      } catch (error) {
        console.error("Error loading extra screenshots:", error)
        setExtraScreenshots([])
      }
    }

    fetchScreenshots()
  }, [solutionData])

  const { showToast } = useToast()

  useEffect(() => {
    // Height update logic
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight
        const contentWidth = contentRef.current.scrollWidth
        if (isTooltipVisible) {
          contentHeight += tooltipHeight
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        })
      }
    }

    // Initialize resize observer
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    // Set up event listeners
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(async () => {
        try {
          const existing = await window.electronAPI.getScreenshots()
          const screenshots = (Array.isArray(existing) ? existing : []).map(
            (p) => ({
              id: p.path,
              path: p.path,
              preview: p.preview,
              timestamp: Date.now()
            })
          )
          setExtraScreenshots(screenshots)
        } catch (error) {
          console.error("Error loading extra screenshots:", error)
        }
      }),
      window.electronAPI.onResetView(() => {
        // Set resetting state first
        setIsResetting(true)

        // Remove queries
        queryClient.removeQueries({
          queryKey: ["solution"]
        })
        queryClient.removeQueries({
          queryKey: ["new_solution"]
        })

        // Reset screenshots
        setExtraScreenshots([])

        // After a small delay, clear the resetting state
        setTimeout(() => {
          setIsResetting(false)
        }, 0)
      }),
      window.electronAPI.onSolutionStart(() => {
        // Every time processing starts, reset relevant states
        setSolutionData(null)
        setThoughtsData(null)
        setTimeComplexityData(null)
        setSpaceComplexityData(null)
        setEdgeCasesData(null)
        setSolutionThinkingData(null)
        setPseudoCodeData(null)

        // Reset loading states
        setLoadingEdgeCases(true)
        setLoadingSolutionThinking(false)
        setLoadingApproach(false)
        setLoadingCode(false)
        setLoadingComplexity(false)
      }),
      window.electronAPI.onProblemExtracted((data: ProblemStatementData) => {
        queryClient.setQueryData(["problem_statement"], data)

        // After problem extraction, we're ready for edge cases
        setLoadingEdgeCases(true)
      }),

      // New event handlers for sequential processing
      window.electronAPI.onEdgeCasesExtracted((data: {
        thoughts: string[]
      }) => {
        const edgeCases = data.thoughts || [];
        console.log("Received edge cases:", edgeCases);
        setEdgeCasesData(edgeCases);
        // Don't set the combined thoughts here
        setLoadingEdgeCases(false);
        setLoadingSolutionThinking(true);
      }),

      window.electronAPI.onSolutionThinking((data: {
        thoughts: string[],
        edgeCases: string[],
        solutionThoughts: string[]
      }) => {
        // Use the already separated data
        console.log("Received solution thinking data:", data);
        // Don't combine thoughts here, just use the solution thoughts directly
        setSolutionThinkingData(data.solutionThoughts || []);
        setLoadingSolutionThinking(false);
        setLoadingApproach(true);
      }),

      window.electronAPI.onApproachDeveloped((data: { thoughts: string[], pseudo_code?: string }) => {
        console.log("Received approach data:", data);
        console.log("Received pseudo_code:", {
          value: data.pseudo_code,
          length: data.pseudo_code ? data.pseudo_code.length : 0,
          is_null: data.pseudo_code === null,
          is_undefined: data.pseudo_code === undefined,
          is_empty: data.pseudo_code === "",
          typeof: typeof data.pseudo_code
        });

        // Set the pseudocode data
        setPseudoCodeData(data.pseudo_code || null);
        setLoadingApproach(false);
        setLoadingCode(true);
      }),

      window.electronAPI.onCodeGenerated((data: { thoughts: string[], code: string }) => {
        // Only set the code, not the accumulated thoughts
        setSolutionData(data.code || null);
        setLoadingCode(false);
        setLoadingComplexity(true);
      }),

      //if there was an error processing the initial solution
      window.electronAPI.onSolutionError((error: string) => {
        showToast("Processing Failed", error, "error")
        // Reset solutions in the cache and complexities to previous states
        const solution = queryClient.getQueryData(["solution"]) as SolutionData | null
        if (!solution) {
          setView("queue")
        }
        setSolutionData(solution?.code || null)
        setThoughtsData(solution?.thoughts || null)
        setTimeComplexityData(solution?.time_complexity || null)
        setSpaceComplexityData(solution?.space_complexity || null)

        // Reset loading states
        setLoadingEdgeCases(false)
        setLoadingSolutionThinking(false)
        setLoadingApproach(false)
        setLoadingCode(false)
        setLoadingComplexity(false)

        console.error("Processing error:", error)
      }),

      //when the final solution is generated, we'll set all the data
      window.electronAPI.onSolutionSuccess((data: SolutionData) => {
        if (!data) {
          console.warn("Received empty or invalid solution data")
          return
        }
        console.log("Solution success with data:", data)

        // Store the final solution data in the query cache
        const solutionData = {
          code: data.code,
          thoughts: data.thoughts,
          time_complexity: data.time_complexity,
          space_complexity: data.space_complexity
        }

        queryClient.setQueryData(["solution"], solutionData)

        // Set the solution code, complexity data
        setSolutionData(solutionData.code || null)
        setTimeComplexityData(solutionData.time_complexity || null)
        setSpaceComplexityData(solutionData.space_complexity || null)

        // Note: We don't update the thoughts data here since we already have them separated
        // by section (edge cases, solution thinking, etc.)

        // Complete all loading states
        setLoadingEdgeCases(false)
        setLoadingSolutionThinking(false)
        setLoadingApproach(false)
        setLoadingCode(false)
        setLoadingComplexity(false)

        // Fetch latest screenshots when solution is successful
        const fetchScreenshots = async () => {
          try {
            const existing = await window.electronAPI.getScreenshots()
            const screenshots =
              existing.previews?.map((p: { path: string, preview: string }) => ({
                id: p.path,
                path: p.path,
                preview: p.preview,
                timestamp: Date.now()
              })) || []
            setExtraScreenshots(screenshots)
          } catch (error) {
            console.error("Error loading extra screenshots:", error)
            setExtraScreenshots([])
          }
        }
        fetchScreenshots()
      }),

      //########################################################
      //DEBUG EVENTS
      //########################################################
      window.electronAPI.onDebugStart(() => {
        //we'll set the debug processing state to true and use that to render a little loader
        setDebugProcessing(true)
      }),
      //the first time debugging works, we'll set the view to debug and populate the cache with the data
      window.electronAPI.onDebugSuccess((data: DebugData) => {
        queryClient.setQueryData(["new_solution"], data)
        setDebugProcessing(false)
      }),
      //when there was an error in the initial debugging, we'll show a toast and stop the little generating pulsing thing.
      window.electronAPI.onDebugError(() => {
        showToast(
          "Processing Failed",
          "There was an error debugging your code.",
          "error"
        )
        setDebugProcessing(false)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no extra screenshots to process.",
          "neutral"
        )
      }),
      // Removed out of credits handler - unlimited credits in this version
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight])

  useEffect(() => {
    setProblemStatementData(
      queryClient.getQueryData(["problem_statement"]) || null
    )
    setSolutionData(queryClient.getQueryData(["solution"]) || null)

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "problem_statement") {
        setProblemStatementData(
          queryClient.getQueryData(["problem_statement"]) || null
        )
      }
      if (event?.query.queryKey[0] === "solution") {
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string
          thoughts: string[]
          time_complexity: string
          space_complexity: string
        } | null

        setSolutionData(solution?.code ?? null)
        setThoughtsData(solution?.thoughts ?? null)
        setTimeComplexityData(solution?.time_complexity ?? null)
        setSpaceComplexityData(solution?.space_complexity ?? null)
      }
    })
    return () => unsubscribe()
  }, [queryClient])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = extraScreenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        // Fetch and update screenshots after successful deletion
        const existing = await window.electronAPI.getScreenshots()
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now()
          })
        )
        setExtraScreenshots(screenshots)
      } else {
        console.error("Failed to delete extra screenshot:", response.error)
        showToast("Error", "Failed to delete the screenshot", "error")
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error)
      showToast("Error", "Failed to delete the screenshot", "error")
    }
  }

  return (
    <>
      {!isResetting && queryClient.getQueryData(["new_solution"]) ? (
        <Debug
          isProcessing={debugProcessing}
          setIsProcessing={setDebugProcessing}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      ) : (
        <div ref={contentRef} className="relative">
          <div className="space-y-3 px-4 py-3">
            {/* Conditionally render the screenshot queue if solutionData is available */}
            {solutionData && (
              <div className="bg-transparent w-fit">
                <div className="pb-3">
                  <div className="space-y-3 w-fit">
                    <ScreenshotQueue
                      isLoading={debugProcessing}
                      screenshots={extraScreenshots}
                      onDeleteScreenshot={handleDeleteExtraScreenshot}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Navbar of commands with the SolutionsHelper */}
            <SolutionCommands
              onTooltipVisibilityChange={handleTooltipVisibilityChange}
              isProcessing={!problemStatementData || !solutionData}
              extraScreenshots={extraScreenshots}
              credits={credits}
              currentLanguage={currentLanguage}
              setLanguage={setLanguage}
            />

            {/* Main Content - Modified width constraints */}
            <div className="w-full text-sm text-black bg-black/60 rounded-md">
              <div className="rounded-lg overflow-hidden">
                <div className="px-4 py-3 space-y-4 max-w-full">
                  {/* Problem Statement (always shows if available) */}
                  {problemStatementData && (
                    <ContentSection
                      title="Problem Statement"
                      content={problemStatementData?.problem_statement}
                      isLoading={!problemStatementData}
                    />
                  )}

                  {/* Edge Cases Section - Shows when loaded or loading */}
                  {(loadingEdgeCases || edgeCasesData) && (
                    <ContentSection
                      title="Edge Cases"
                      content={
                        edgeCasesData && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              {edgeCasesData.map((edgeCase, index) => (
                                <div key={index} className="flex items-start gap-2">
                                  <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
                                  <div>{edgeCase}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }
                      isLoading={loadingEdgeCases}
                    />
                  )}

                  {/* Solution Thinking Section - Shows when loading or loaded */}
                  {(loadingSolutionThinking || solutionThinkingData) && (
                    <ContentSection
                      title="Solution Thinking"
                      content={
                        solutionThinkingData && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              {solutionThinkingData.map((thought, index) => (
                                <div key={index} className="flex items-start gap-2">
                                  <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
                                  <div>{thought}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }
                      isLoading={loadingSolutionThinking}
                    />
                  )}

                  {/* Approach Section - Shows when approach is loading or loaded */}
                  {(loadingApproach || pseudoCodeData) && (
                    <SolutionSection
                      title="Pseudocode"
                      content={pseudoCodeData || ""}
                      isLoading={loadingApproach}
                      currentLanguage={currentLanguage}
                    />
                  )}

                  {/* Solution Section - Shows when solution code is loading or loaded */}
                  {(loadingCode || solutionData) && (
                    <SolutionSection
                      title="Solution"
                      content={solutionData}
                      isLoading={loadingCode}
                      currentLanguage={currentLanguage}
                    />
                  )}

                  {/* Complexity Section - Shows when complexity is loading or loaded */}
                  {(loadingComplexity || timeComplexityData) && (
                    <ComplexitySection
                      timeComplexity={timeComplexityData}
                      spaceComplexity={spaceComplexityData}
                      isLoading={loadingComplexity}
                    />
                  )}

                  {/* Loading indicator when we're at initial stages */}
                  {problemStatementData && !thoughtsData && !loadingEdgeCases && !loadingApproach && (
                    <div className="mt-4 flex">
                      <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
                        Starting solution generation...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Solutions
