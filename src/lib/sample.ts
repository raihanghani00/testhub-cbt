const chart =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="280" viewBox="0 0 520 280"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect width="520" height="280" rx="18" fill="#eef2ff"/><g font-family="Arial" font-size="14" fill="#334155" text-anchor="middle"><line x1="50" y1="230" x2="490" y2="230" stroke="#94a3b8"/><rect x="90" y="150" width="60" height="80" rx="6" fill="url(#g)"/><rect x="190" y="100" width="60" height="130" rx="6" fill="url(#g)"/><rect x="290" y="120" width="60" height="110" rx="6" fill="url(#g)"/><rect x="390" y="50" width="60" height="180" rx="6" fill="url(#g)"/><text x="120" y="142">40</text><text x="220" y="92">65</text><text x="320" y="112">55</text><text x="420" y="42">90</text><text x="120" y="252">2021</text><text x="220" y="252">2022</text><text x="320" y="252">2023</text><text x="420" y="252">2024</text><text x="260" y="24" font-weight="bold" font-size="15">Production (thousand units)</text></g></svg>`,
  );

export const SAMPLE_TXT = `[SECTION: Quantitative Aptitude]

Q1. If $x^2 - 5x + 6 = 0$, what is the sum of the roots of the equation?
A) 5
B) 6
C) -5
D) 1
Ans: A
Exp: For $ax^2+bx+c=0$ the sum of roots is $-\\frac{b}{a} = -\\frac{-5}{1} = 5$. The roots are 2 and 3.

Q2. The bar chart shows the production of a factory (in thousand units) from 2021 to 2024. What is the percentage increase in production from 2021 to 2024?
Img: ${chart}
A) 100%
B) 125%
C) 150%
D) 225%
Ans: B
Exp: Increase = $\\frac{90-40}{40} \\times 100 = 125\\%$.

Q3. A train 120 m long running at 54 km/h crosses a pole. How much time does it take?
A) 6 s
B) 7 s
C) 8 s
D) 9 s
Ans: C
Exp: Speed = $54 \\times \\frac{5}{18} = 15$ m/s. Time = $\\frac{120}{15} = 8$ s.

Q4. Evaluate $\\int_0^2 3x^2\\,dx$.
A) 4
B) 6
C) 12
D) 8
Ans: D
Exp: $\\int_0^2 3x^2\\,dx = [x^3]_0^2 = 8$.

[SECTION: Logical Reasoning]

Q5. Find the next number in the series: 2, 6, 12, 20, 30, ?
A) 42
B) 40
C) 36
D) 44
Ans: A
Exp: Differences are 4, 6, 8, 10, so the next difference is 12. $30 + 12 = 42$.

Q6. If in a certain code CAT is written as 24 (3 + 1 + 20), then DOG is written as?
A) 24
B) 26
C) 28
D) 27
Ans: B
Exp: D = 4, O = 15, G = 7 and $4 + 15 + 7 = 26$.

Q7. A man walks 5 km north, turns right and walks 3 km, then turns right again and walks 5 km. How far is he from the starting point?
A) 5 km
B) 8 km
C) 3 km
D) 13 km
Ans: C
Exp: He ends up directly east of the start, 3 km away.

Q8. Choose the odd one out.
A) Apple
B) Carrot
C) Banana
D) Mango
Ans: B
Exp: Carrot is a vegetable while the others are fruits.

[SECTION: English Language]

Q9. Choose the word closest in meaning to "EPHEMERAL".
A) Eternal
B) Massive
C) Fragile
D) Short-lived
Ans: D
Exp: Ephemeral means lasting for a very short time.

Q10. Fill in the blank: She has been working here ___ 2019.
A) for
B) since
C) from
D) during
Ans: B
Exp: "Since" is used with a specific point in time.

Q11. Choose the antonym of "BENEVOLENT".
A) Kind
B) Generous
C) Malevolent
D) Charitable
Ans: C
Exp: Benevolent means well-meaning; malevolent means wishing harm.

Q12. What does the idiom "break the ice" mean?
A) Start a conversation in a social setting
B) End a relationship
C) Shatter something
D) Feel very cold
Ans: A
Exp: To break the ice is to ease initial social tension.
`;
