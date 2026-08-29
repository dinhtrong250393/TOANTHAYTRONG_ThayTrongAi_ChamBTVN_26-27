awk '
/responseSchema:/,/\}\},/ { next }
{ print $0 }
' server.ts > temp_server.ts && mv temp_server.ts server.ts
