text = open('app/dashboard/okr/page.tsx').read()
lines = text.split('\n')
p_stack = []
b_stack = []
c_stack = []
for i, line in enumerate(lines[789:1122], 790):
  in_string = False
  str_ch = None
  j = 0
  while j < len(line):
    ch = line[j]
    if in_string:
      if ch == str_ch and (j == 0 or line[j-1] != '\\'):
        in_string = False
      j += 1
      continue
    if ch in "'\"`":
      in_string = True
      str_ch = ch
      j += 1
      continue
    if ch == '/' and j+1 < len(line) and line[j+1] == '/':
      break
    if ch == '(':
      p_stack.append((i, j))
    elif ch == ')':
      if p_stack:
        p_stack.pop()
      else:
        print(f'Unmatched ) at {i}:{j}')
    elif ch == '[':
      b_stack.append((i, j))
    elif ch == ']':
      if b_stack:
        b_stack.pop()
      else:
        print(f'Unmatched ] at {i}:{j}')
    elif ch == '{':
      c_stack.append((i, j))
    elif ch == '}':
      if c_stack:
        c_stack.pop()
      else:
        print(f'Unmatched }} at {i}:{j}')
    j += 1

print(f'Unclosed: parens={len(p_stack)}, brackets={len(b_stack)}, braces={len(c_stack)}')
for s in p_stack[-5:]:
  print(f'p open line {s[0]}:', lines[s[0]-1][:100])
for s in b_stack[-3:]:
  print(f'b open line {s[0]}:', lines[s[0]-1][:100])
