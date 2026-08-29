awk '
/await addDoc\(collection\(db, '\''essays'\''\)/ {
    print "      const docRef = await addDoc(collection(db, \"essays\"), essayData);"
    print "      try {"
    print "        const { saveEssayMetadata, syncEssaysCover, syncClassSummary } = await import(\"../lib/syncUtils\");"
    print "        const { syncEssayResultsCover } = await import(\"../lib/firebase\");"
    print "        await saveEssayMetadata(docRef.id, essayData);"
    print "        if (syncEssayResultsCover) await syncEssayResultsCover(docRef.id);"
    print "        if (assignedClasses && assignedClasses.length > 0) {"
    print "          for (const className of assignedClasses) {"
    print "            await syncClassSummary(className);"
    print "          }"
    print "        }"
    print "        await syncEssaysCover(appUser.uid);"
    print "      } catch (err) { console.error(\"Sync error\", err); }"
    next
}
{ print $0 }
' src/pages/TextbookBuilder.tsx > temp.tsx && mv temp.tsx src/pages/TextbookBuilder.tsx
