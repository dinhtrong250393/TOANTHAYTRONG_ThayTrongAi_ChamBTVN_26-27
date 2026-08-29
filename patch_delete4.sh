awk '
/  \);/ {
    print "      {itemToDelete && (";
    print "        <div className=\"fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99] flex items-center justify-center p-4\">";
    print "          <div className=\"bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200\">";
    print "            <div className=\"w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4 mx-auto\">";
    print "              <Trash2 className=\"w-6 h-6\" />";
    print "            </div>";
    print "            <h3 className=\"text-xl font-bold text-slate-800 text-center mb-2\">Xác nhận xóa</h3>";
    print "            <p className=\"text-slate-500 text-center mb-6\">Bạn có chắc chắn muốn xóa mục này? Hành động này không thể hoàn tác.</p>";
    print "            <div className=\"flex space-x-3\">";
    print "              <button";
    print "                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setItemToDelete(null); }}";
    print "                className=\"flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors\"";
    print "              >";
    print "                Hủy";
    print "              </button>";
    print "              <button";
    print "                onClick={(e) => { e.preventDefault(); e.stopPropagation(); executeDelete(itemToDelete.collection, itemToDelete.id); }}";
    print "                className=\"flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors shadow-sm\"";
    print "              >";
    print "                Xóa";
    print "              </button>";
    print "            </div>";
    print "          </div>";
    print "        </div>";
    print "      )}";
}
{ print $0 }
' src/components/TeacherTextbookTab.tsx > temp.tsx && mv temp.tsx src/components/TeacherTextbookTab.tsx
