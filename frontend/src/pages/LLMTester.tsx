import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, CheckCircle, XCircle } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function LLMTester() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<Array<{
    userMessage: string;
    response: any;
    timestamp: string;
  }>>([]);

  const testLLM = async () => {
    if (!message.trim()) return;

    setLoading(true);
    const userMessage = message;
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();
      
      setResponses(prev => [{
        userMessage,
        response: data,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev]);

    } catch (error: any) {
      setResponses(prev => [{
        userMessage,
        response: {
          success: false,
          error: error.message || "Network error",
        },
        timestamp: new Date().toLocaleTimeString()
      }, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      testLLM();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">🤖 LLM Connectivity Tester</CardTitle>
            <p className="text-sm text-gray-500">
              Test if the LLM is responding correctly
            </p>
          </CardHeader>
          <CardContent>
            {/* Input Section */}
            <div className="flex gap-2 mb-6">
              <Input
                type="text"
                placeholder="Type a message to test the LLM..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                className="flex-1"
              />
              <Button 
                onClick={testLLM} 
                disabled={loading || !message.trim()}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send
                  </>
                )}
              </Button>
            </div>

            {/* Quick Test Buttons */}
            <div className="flex gap-2 mb-6 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessage("Hello! Are you working?")}
                disabled={loading}
              >
                Quick Test 1
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessage("What is 2+2?")}
                disabled={loading}
              >
                Quick Test 2
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessage("Explain React in one sentence")}
                disabled={loading}
              >
                Quick Test 3
              </Button>
            </div>

            {/* Responses */}
            <div className="space-y-4">
              {responses.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No tests yet. Send a message to test the LLM connection.
                </div>
              ) : (
                responses.map((item, index) => (
                  <Card key={index} className={item.response.success ? "border-green-200" : "border-red-200"}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3 mb-3">
                        {item.response.success ? (
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-1" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-1" />
                        )}
                        <div className="flex-1 space-y-2">
                          <div>
                            <span className="font-semibold">You:</span>
                            <p className="text-sm text-gray-700 mt-1">{item.userMessage}</p>
                          </div>

                          {item.response.success ? (
                            <div className="bg-green-50 p-3 rounded">
                              <span className="font-semibold text-green-800">LLM Response:</span>
                              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                                {item.response.message}
                              </p>
                              <div className="text-xs text-gray-500 mt-2">
                                ⏱️ Response time: {item.response.responseTime}ms
                              </div>
                            </div>
                          ) : (
                            <div className="bg-red-50 p-3 rounded">
                              <span className="font-semibold text-red-800">Error:</span>
                              <p className="text-sm text-red-700 mt-1">
                                {item.response.error}
                              </p>
                            </div>
                          )}

                          <div className="text-xs text-gray-400">
                            {item.timestamp}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
