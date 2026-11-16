const step = (node, en, ar, requires) => ({ node, text: [en, ar], requires });
const browser = (en, ar) => step('browser', en, ar);
const report = title => ({ title, queue: true, steps: [
    browser('Request a report for the selected time range.', 'اطلب تقريرًا للفترة الزمنية المحددة.'),
    step('api', 'Validate the report parameters and accept the job.', 'تحقّق من معلمات التقرير واقبل المهمة.'),
    step('queue', 'Queue the job so report generation runs outside the request.', 'أضف المهمة إلى القائمة ليُنشأ التقرير خارج الطلب.'),
    step('workers', 'Generate the report using the requested filters.', 'أنشئ التقرير باستخدام عوامل التصفية المطلوبة.'),
    browser('Show that the report is ready when processing finishes.', 'اعرض أن التقرير جاهز عند انتهاء المعالجة.')
] });

export const scenarios = {
    saas: {
        workspace: { title: ['Load workspace', 'تحميل مساحة العمل'], motion: 'workspace', steps: [
            browser('Open the workspace and request its dashboard.', 'افتح مساحة العمل واطلب لوحة التحكم.'),
            step('api', 'Read the workspace request and its available context.', 'اقرأ طلب مساحة العمل وسياقه المتاح.'),
            step('auth', 'Verify the session before reading private workspace data.', 'تحقّق من الجلسة قبل قراءة بيانات مساحة العمل الخاصة.', 'auth'),
            step('tenant', 'Resolve the tenant scope used to restrict the query.', 'حدّد نطاق المستأجر الذي يقيّد الاستعلام.', 'tenant'),
            step('postgres', 'Read the rows needed to build the workspace dashboard.', 'اقرأ الصفوف اللازمة لبناء لوحة تحكم مساحة العمل.'),
            { ...step('api', 'Prepare a response from the database results.', 'جهّز الاستجابة من نتائج قاعدة البيانات.'), channel: 'response' },
            { ...browser('Update the dashboard with the returned workspace data.', 'حدّث لوحة التحكم ببيانات مساحة العمل المستلمة.'), channel: 'response', outcome: 'workspaceReady' }
        ] },
        signIn: { title: ['Sign in', 'تسجيل الدخول'], auth: true, steps: [
            browser('Submit sign-in credentials over HTTPS.', 'أرسل بيانات تسجيل الدخول عبر HTTPS.'),
            step('api', 'Validate the request and ask the identity service to verify it.', 'تحقّق من الطلب واطلب من خدمة الهوية التحقق منه.'),
            step('auth', 'Verify identity and issue a session on success.', 'تحقّق من الهوية وأنشئ جلسة عند النجاح.'),
            browser('Open the workspace using the new session.', 'افتح مساحة العمل باستخدام الجلسة الجديدة.')
        ] },
        report: report(['Generate report', 'إنشاء تقرير'])
    },
    ecommerce: {
        browse: { title: ['Browse products', 'تصفّح المنتجات'], steps: [
            browser('Select a category in the storefront.', 'اختر فئة في المتجر.'),
            step('api', 'Translate the category and pagination into a catalog query.', 'حوّل الفئة والترقيم إلى استعلام في الكتالوج.'),
            step('postgres', 'Read matching product names, prices and availability.', 'اقرأ أسماء المنتجات المطابقة وأسعارها وتوفّرها.'),
            browser('Replace the product grid with the matching results.', 'حدّث شبكة المنتجات بالنتائج المطابقة.')
        ] },
        cart: { title: ['Add to cart', 'الإضافة إلى السلة'], steps: [
            browser('Choose a product and quantity.', 'اختر منتجًا وكمية.'),
            browser('Add or update the item in the local cart.', 'أضف العنصر أو حدّثه في السلة المحلية.'),
            browser('Update the bag count and subtotal. Checkout validates the final total.', 'حدّث عدد عناصر السلة والمجموع الفرعي. يتحقّق الخادم من الإجمالي عند إتمام الطلب.')
        ] },
        checkout: { title: ['Checkout', 'إتمام الطلب'], motion: 'checkout', queue: true, steps: [
            browser('Submit the cart and delivery details.', 'أرسل السلة وتفاصيل التوصيل.'),
            step('api', 'Validate quantities and calculate the order total on the server.', 'تحقّق من الكميات واحسب إجمالي الطلب على الخادم.'),
            step('auth', 'Verify the customer session if authentication is enabled.', 'تحقّق من جلسة العميل إذا كانت المصادقة مفعّلة.', 'auth'),
            step('postgres', 'Commit the order and its line items together.', 'احفظ الطلب وبنوده في معاملة واحدة.'),
            { ...step('api', 'Use the committed order ID to build the confirmation response.', 'استخدم معرّف الطلب المحفوظ لإعداد استجابة التأكيد.'), channel: 'response' },
            { ...browser('Show the confirmed order. Fulfillment, if configured, runs independently.', 'اعرض الطلب المؤكّد. يُنفّذ الشحن بشكل مستقل عند إعداده.'), channel: 'response', outcome: 'orderConfirmed' },
            { ...step('queue', 'Separately enqueue a fulfillment job for the committed order.', 'أضف بشكل مستقل مهمة شحن للطلب المحفوظ.', 'queue'), branchFrom: 'api', channel: 'background' },
            { ...step('workers', 'Pick up the fulfillment job without holding up the confirmation.', 'ابدأ مهمة الشحن دون تأخير تأكيد الطلب.', 'workers'), channel: 'background' }
        ] }
    },
    landing: {
        demo: { title: ['Submit demo form', 'إرسال طلب عرض'], steps: [
            browser('Validate the form fields and submit the demo request.', 'تحقّق من حقول النموذج وأرسل طلب العرض.'),
            step('api', 'Validate the email and normalize the input on the server.', 'تحقّق من البريد الإلكتروني ونسّق المدخلات على الخادم.'),
            step('postgres', 'Store the demo request for follow-up.', 'احفظ طلب العرض للمتابعة.'),
            browser('Show a confirmation once the request has been accepted.', 'اعرض تأكيدًا بعد قبول الطلب.')
        ] },
        brochure: { title: ['Download brochure', 'تنزيل الكتيّب'], steps: [
            browser('Select the downloadable brochure on the landing page.', 'اختر الكتيّب القابل للتنزيل من صفحة الهبوط.'),
            browser('Request the static file from the site host without a database query.', 'اطلب الملف الثابت من مضيف الموقع دون استعلام قاعدة البيانات.'),
            browser('Hand the downloaded file to the browser’s download manager.', 'سلّم الملف إلى مدير التنزيلات في المتصفح.')
        ] }
    },
    'internal-tool': {
        filter: { title: ['Filter records', 'تصفية السجلات'], steps: [
            browser('Choose a status filter in the operations inbox.', 'اختر عامل تصفية للحالة في صندوق العمليات.'),
            step('api', 'Validate the filter and apply any record access rules.', 'تحقّق من عامل التصفية وطبّق قواعد الوصول إلى السجلات.'),
            step('postgres', 'Return records matching the filter and access rules.', 'أعد السجلات المطابقة لعامل التصفية وقواعد الوصول.'),
            browser('Update the table while keeping the selected filter.', 'حدّث الجدول مع إبقاء عامل التصفية المحدد.')
        ] },
        approve: { title: ['Approve request', 'الموافقة على طلب'], steps: [
            browser('Submit an approval for the selected request.', 'أرسل الموافقة على الطلب المحدد.'),
            step('api', 'Check approval permission and whether the request is still pending.', 'تحقّق من صلاحية الموافقة ومن أن الطلب ما زال معلقًا.'),
            step('postgres', 'Write the status change as a transaction.', 'احفظ تغيير الحالة ضمن معاملة.'),
            browser('Show the updated request status to the operator.', 'اعرض حالة الطلب المحدّثة للمستخدم.')
        ] },
        report: { title: ['Export records', 'تصدير السجلات'], motion: 'export', queue: true, steps: [
            browser('Request a CSV export for the selected records and filters.', 'اطلب تصدير السجلات المحددة إلى CSV وفق عوامل التصفية.'),
            step('api', 'Validate the requested fields and filters before reading records.', 'تحقّق من الحقول وعوامل التصفية المطلوبة قبل قراءة السجلات.'),
            step('auth', 'Verify the session used to authorize the export.', 'تحقّق من الجلسة المستخدمة لتفويض التصدير.', 'auth'),
            step('tenant', 'Restrict the export to records within the tenant scope.', 'اقصر التصدير على السجلات الواقعة ضمن نطاق المستأجر.', 'tenant'),
            step('postgres', 'Read the permitted records that match the requested filters.', 'اقرأ السجلات المسموح بها المطابقة لعوامل التصفية.'),
            { ...step('api', 'Pass the query results to the export process.', 'مرّر نتائج الاستعلام إلى عملية التصدير.'), channel: 'response' },
            { ...step('queue', 'Enqueue CSV generation outside the request.', 'أضف إنشاء ملف CSV إلى قائمة المهام خارج الطلب.', 'queue'), channel: 'background' },
            { ...step('workers', 'Format the export rows and headers as CSV.', 'نسّق صفوف التصدير وعناوينها بصيغة CSV.', 'workers'), channel: 'background' },
            { ...step('objects', 'Write the CSV output to configured storage for retrieval.', 'احفظ ملف CSV في التخزين المُعدّ لاسترجاعه.', 'objects'), socket: 'artifact', outcome: 'exportCreated' },
            { ...step('workers', 'Finish generating the CSV output for retrieval.', 'أكمل إنشاء ملف CSV ليصبح متاحًا للاسترجاع.', 'workers'), without: ['objects'], socket: 'artifact', outcome: 'exportCreated' },
            { ...step('api', 'Generate the CSV and return it with the response.', 'أنشئ ملف CSV وأعده مع الاستجابة.'), without: ['objects', 'workers'], socket: 'artifact', outcome: 'exportCreated' },
            { ...browser('Show that records.csv is ready. This example creates no actual download.', 'اعرض أن records.csv جاهز. لا يُنشئ هذا المثال تنزيلًا فعليًا.'), channel: 'response', outcome: 'exportReady' }
        ] }
    }
};
