awk '
/const \[isCreating, setIsCreating\] = useState\(false\);/ {
    print $0;
    print "  const [itemToDelete, setItemToDelete] = useState<{collection: string, id: string} | null>(null);";
    next;
}
/const handleDelete = async/ {
    print "  const executeDelete = async (collectionName: string, id: string) => {";
    print "    try {";
    print "      await deleteDoc(doc(db, collectionName, id));";
    print "      if (collectionName === '\''textbook_grades'\'') setGrades(prev => prev.filter(g => g.id !== id));";
    print "      if (collectionName === '\''textbook_chapters'\'') setChapters(prev => prev.filter(c => c.id !== id));";
    print "      if (collectionName === '\''textbook_lessons'\'') setLessons(prev => prev.filter(l => l.id !== id));";
    print "      if (collectionName === '\''essays'\'') setExercises(prev => prev.filter(e => e.id !== id));";
    print "      setItemToDelete(null);";
    print "    } catch (err) {";
    print "      console.error(err);";
    print "      alert('\''Có lỗi khi xóa!'\'');";
    print "    }";
    print "  };";
    print "";
    print "  const handleDeleteClick = (collectionName: string, id: string, e: React.MouseEvent) => {";
    print "    e.preventDefault();";
    print "    e.stopPropagation();";
    print "    setItemToDelete({ collection: collectionName, id });";
    print "  };";
    skip = 1;
    next;
}
skip {
    if ($0 ~ /  };/) {
        skip = 0;
    }
    next;
}
/handleDelete\(\!currentGrade \?/ {
    sub(/handleDelete\(/, "handleDeleteClick(");
    print $0;
    # Now it says handleDeleteClick(!currentGrade ? ... , item.id);
    # But wait, it originally had: handleDelete(!currentGrade ? ... , item.id);
    # Let us replace it precisely. Wait, we can use sed for this.
    next;
}
{ print $0 }
' src/components/TeacherTextbookTab.tsx > temp.tsx && mv temp.tsx src/components/TeacherTextbookTab.tsx
