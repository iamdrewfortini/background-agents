// Test file to trigger code review agent
function testFunction(a, b) {
    // Intentionally complex nested conditions to trigger code review
    if (a > 0) {
        if (b > 0) {
            if (a > b) {
                if (a - b > 10) {
                    return a - b;
                }
            }
        }
    }
    
    // Potential security issue: eval usage
    const result = eval("2 + 2");
    
    // Performance issue: unnecessary loop
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
        sum += i;
    }
    
    return result;
}

// Unused variable
const unusedVar = "This should be flagged";

module.exports = { testFunction };