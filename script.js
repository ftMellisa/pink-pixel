
"use strict";

// ==========================================
// 1. CONNECT TO THE HTML
// ==========================================

const resultDisplay = document.getElementById("result");
const expressionDisplay = document.getElementById("expression");
const keypad = document.getElementById("keypad");

if (!resultDisplay || !expressionDisplay || !keypad) {
    throw new Error("PINK PIXEL: calculator HTML elements are missing.");
}

// ==========================================
// 2. CALCULATOR STATE
// ==========================================

// The expression is the full calculation being entered.
let expression = "";
let lastResult = null;
let justEvaluated = false;

const operatorSymbols = {
    "+": "+",
    "-": "−",
    "*": "×",
    "/": "÷"
};

// ==========================================
// 3. FORMAT NUMBERS FOR THE DISPLAY
// ==========================================

function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return "Error";
    }

    const rounded = Number(value.toPrecision(12));

    return rounded.toLocaleString("en-US", {
        maximumFractionDigits: 10
    });
}

function displayExpression(value) {
    return value.replace(/[*/]/g, operator => operatorSymbols[operator]);
}


function animateResult() {
    resultDisplay.classList.remove("number-pop");

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            resultDisplay.classList.add("number-pop");
        });
    });
}


function updateDisplay() {
    expressionDisplay.textContent =
        expression ? displayExpression(expression) : "Ready when you are ♡";

    if (justEvaluated && lastResult !== null) {
        resultDisplay.textContent = formatNumber(lastResult);
        animateResult();
        return;
    }

    // Show a live preview when the expression is currently valid.
    try {
        if (expression && /[\d)]$/.test(expression)) {
            resultDisplay.textContent =
                formatNumber(evaluateExpression(expression));

            animateResult();    
        } else {
            resultDisplay.textContent = "0";
        }
    } catch {
        resultDisplay.textContent = "0";
    }
}

// ==========================================
// 4. TOKENISE THE EXPRESSION
// ==========================================

// Convert text such as "2+3*(4-1)" into individual tokens.
// eval() is deliberately not used.

function tokenize(input) {
    const tokens = [];
    let position = 0;

    while (position < input.length) {
        const remaining = input.slice(position);

        // Ignore spaces.
        if (/^\s/.test(remaining)) {
            position++;
            continue;
        }

        // Read a number, including decimals and scientific notation.
        const numberMatch = remaining.match(
            /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/
        );

        if (numberMatch) {
            const value = Number(numberMatch[0]);

            if (!Number.isFinite(value)) {
                throw new Error("Number is out of range.");
            }

            tokens.push({ type: "number", value });
            position += numberMatch[0].length;
            continue;
        }

        // Recognise supported operators and parentheses.
        const character = input[position];

        if ("+-*/()".includes(character)) {
            tokens.push({ type: character, value: character });
            position++;
            continue;
        }

        throw new Error(`Invalid character: ${character}`);
    }

    return tokens;
}

// ==========================================
// 5. PARSE AND CALCULATE
// ==========================================

// Grammar:
// expression = term (("+" | "-") term)*
// term       = unary (("*" | "/") unary)*
// unary      = ("+" | "-") unary | primary
// primary    = number | "(" expression ")"

function evaluateExpression(input) {
    const tokens = tokenize(input);
    let position = 0;

    function peek() {
        return tokens[position];
    }

    function consume(type) {
        const token = peek();

        if (!token || token.type !== type) {
            throw new Error("Invalid expression.");
        }

        position++;
        return token;
    }

    // Numbers and parenthesised expressions.
    function parsePrimary() {
        if (peek()?.type === "number") {
            return consume("number").value;
        }

        if (peek()?.type === "(") {
            consume("(");
            const value = parseExpression();
            consume(")");
            return value;
        }

        throw new Error("Expected a number or parentheses.");
    }

    // Unary plus and minus, such as -5 or -(2+3).
    function parseUnary() {
        if (peek()?.type === "+") {
            consume("+");
            return parseUnary();
        }

        if (peek()?.type === "-") {
            consume("-");
            return -parseUnary();
        }

        return parsePrimary();
    }

    // Multiplication and division have higher precedence.
    function parseTerm() {
        let value = parseUnary();

        while (peek()?.type === "*" || peek()?.type === "/") {
            const operator = peek().type;
            position++;

            const right = parseUnary();

            if (operator === "/" && right === 0) {
                throw new Error("Cannot divide by zero.");
            }

            value = operator === "*" ? value * right : value / right;

            if (!Number.isFinite(value)) {
                throw new Error("Result is out of range.");
            }
        }

        return value;
    }

    // Addition and subtraction have lower precedence.
    function parseExpression() {
        let value = parseTerm();

        while (peek()?.type === "+" || peek()?.type === "-") {
            const operator = peek().type;
            position++;

            const right = parseTerm();

            value = operator === "+" ? value + right : value - right;

            if (!Number.isFinite(value)) {
                throw new Error("Result is out of range.");
            }
        }

        return value;
    }

    if (tokens.length === 0) {
        throw new Error("Enter a calculation first.");
    }

    const result = parseExpression();

    // Reject leftover tokens, such as "2(3)" or "4+5 6".
    if (position !== tokens.length) {
        throw new Error("Check your expression.");
    }

    return result;
}

// ==========================================
// 6. INPUT HANDLING
// ==========================================

function inputDigit(digit) {
    if (justEvaluated) {
        expression = "";
        justEvaluated = false;
    }

    // Avoid accidental adjacent numbers after a closing bracket.
    if (expression.endsWith(")")) {
        expression += "*";
    }

    expression += digit;
    updateDisplay();
}

function inputDecimal() {
    if (justEvaluated) {
        expression = "";
        justEvaluated = false;
    }

    // Find the number currently being entered.
    const lastNumber = expression.match(
        /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/
    );

    if (lastNumber && lastNumber[0].includes(".")) {
        return;
    }

    if (expression.endsWith(")")) {
        expression += "*0.";
    } else if (!expression || /[+\-*/(]$/.test(expression)) {
        expression += "0.";
    } else {
        expression += ".";
    }

    updateDisplay();
}

function inputOperator(operator) {
    if (justEvaluated) {
        expression = String(lastResult);
        justEvaluated = false;
    }

    if (!expression) {
        // Allow negative numbers at the start.
        if (operator === "-") {
            expression = "-";
            updateDisplay();
        }
        return;
    }

    const lastCharacter = expression.slice(-1);

    if ("+-*/".includes(lastCharacter)) {
        // Allow a negative number after an operator, e.g. 5*-2.
        if (operator === "-" && lastCharacter !== "-") {
            expression += "-";
        } else if (expression.length > 1) {
            expression = expression.slice(0, -1) + operator;
        }
    } else if (lastCharacter === "(") {
        if (operator === "-") {
            expression += "-";
        }
    } else {
        expression += operator;
    }

    updateDisplay();
}

function inputParenthesis(bracket) {
    if (justEvaluated) {
        if (bracket === "(") {
            expression = "";
        } else {
            expression = String(lastResult);
            return;
        }

        justEvaluated = false;
    }

    if (bracket === "(") {
        // Support implicit multiplication, such as 2*(3+4).
        if (/[\d)]$/.test(expression)) {
            expression += "*";
        }

        expression += "(";
    } else {
        const opens = (expression.match(/\(/g) || []).length;
        const closes = (expression.match(/\)/g) || []).length;

        // Only close an existing, unmatched opening bracket.
        if (opens > closes && /[\d)]$/.test(expression)) {
            expression += ")";
        }
    }

    updateDisplay();
}

// ==========================================
// 7. EQUALS AND ERROR HANDLING
// ==========================================

function calculateResult() {
    if (!expression) {
        return;
    }

    try {
        const result = evaluateExpression(expression);

        lastResult = result;
        // Keep the calculation display free of the equals sign.
        justEvaluated = true;

        expressionDisplay.textContent = displayExpression(expression);
        resultDisplay.textContent = formatNumber(result);
        animateResult();
    } catch (error) {
        expressionDisplay.textContent =
            error.message || "Invalid expression";

        resultDisplay.textContent = "Error";
        lastResult = null;
        justEvaluated = false;
    }
}

// ==========================================
// 8. CLEAR, SIGN, PERCENT AND BACKSPACE
// ==========================================

function clearCalculator() {
    expression = "";
    lastResult = null;
    justEvaluated = false;
    updateDisplay();
}

function backspace() {
    if (justEvaluated) {
        clearCalculator();
        return;
    }

    expression = expression.slice(0, -1);
    updateDisplay();
}

function toggleSign() {
    if (justEvaluated && lastResult !== null) {
        expression = String(-lastResult);
        lastResult = -lastResult;
        justEvaluated = true;
        updateDisplay();
        return;
    }

    const match = expression.match(
        /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/
    );

    if (!match) {
        if (!expression || /[+\-*/(]$/.test(expression)) {
            expression += "-";
        }

        updateDisplay();
        return;
    }

    const start = match.index;
    const beforeNumber = expression.slice(0, start);
    const unaryMinus = beforeNumber.endsWith("-") &&
        (beforeNumber.length === 1 ||
         /[+\-*/(]$/.test(beforeNumber.slice(0, -1)));

    if (unaryMinus) {
        expression =
            beforeNumber.slice(0, -1) + match[0];
    } else {
        expression = beforeNumber + "-" + match[0];
    }

    updateDisplay();
}

function inputPercent() {
    if (justEvaluated && lastResult !== null) {
        lastResult /= 100;
        expression = String(lastResult);
        justEvaluated = true;
        updateDisplay();
        return;
    }

    const match = expression.match(
        /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/
    );

    if (match) {
        const percentValue = Number(match[0]) / 100;

        expression =
            expression.slice(0, match.index) + String(percentValue);

        updateDisplay();
    }
}

// ==========================================
// 9. BUTTON EVENTS
// ==========================================

keypad.addEventListener("click", function (event) {
    const button = event.target.closest("button");

    if (!button || !keypad.contains(button)) {
        return;
    }

    const { action, value } = button.dataset;

    switch (action) {
        case "digit":
            inputDigit(value);
            break;

        case "decimal":
            inputDecimal();
            break;

        case "operator":
            inputOperator(value);
            break;

        case "paren":
            inputParenthesis(value);
            break;

        case "equals":
            calculateResult();
            break;

        case "clear":
            clearCalculator();
            break;

        case "sign":
            toggleSign();
            break;

        case "percent":
            inputPercent();
            break;

        case "backspace":
            backspace();
            break;
    }
});

// ==========================================
// 10. KEYBOARD SUPPORT
// ==========================================

document.addEventListener("keydown", function (event) {
    if (/^[0-9]$/.test(event.key)) {
        inputDigit(event.key);
        return;
    }

    if (event.key === ".") {
        inputDecimal();
        return;
    }

    if (["+", "-", "*", "/"].includes(event.key)) {
        inputOperator(event.key);
        return;
    }

    if (event.key === "(" || event.key === ")") {
        inputParenthesis(event.key);
        return;
    }

    if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        calculateResult();
        return;
    }

    if (event.key === "Backspace") {
        backspace();
        return;
    }

    if (event.key === "Escape") {
        clearCalculator();
    }
});

// ==========================================
// 11. START THE CALCULATOR
// ==========================================

updateDisplay();
