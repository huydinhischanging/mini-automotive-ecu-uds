// Advanced, chapter 13: the C++20 tester and object-oriented design.
module.exports = {
  level: { id: 'advanced' },
  chapters: [
    {
      id: 'c13', t: 'Tester C++20 và lập trình hướng đối tượng',
      lessons: [
        {
          id: '13.1', t: 'C++ cần biết để đọc tester',
          subs: [
            {
              id: '13.1.1', t: 'Từ C sang C++: class, namespace, tham chiếu, enum class và CMake', min: 30, pre: ['2.2.1', '2.2.2'],
              concepts: [
                ['class', 'Gom dữ liệu (thành viên ⟦m_…⟧) và hàm (method) thao tác trên dữ liệu đó; quyền truy cập public/private.'],
                ['namespace', 'Không gian tên, thay cho tiền tố kiểu ⟦Uds_⟧ trong C: ⟦uds::UdsClient⟧.'],
                ['Tham chiếu (T&)', 'Bí danh của một đối tượng có sẵn; giống con trỏ không bao giờ NULL và không đổi chỗ trỏ.'],
                ['enum class', 'Enum có phạm vi và kiểu mạnh: ⟦Session::Extended⟧, không tự đổi sang số.'],
              ],
              goal: `Bạn đọc được mọi header trong ⟦tester/include/uds/⟧ bằng cách đối chiếu với thứ bạn đã biết trong C, và tự build, chạy tester.`,
              bg: `Bạn không cần học hết C++. Tester khoảng 1 600 dòng, dùng một tập nhỏ khái niệm. Mỗi khái niệm đều có "tương đương C" trong chính project này.`,
              th: `| C++ | Ví dụ trong tester | Tương đương C trong project |
|---|---|---|
| ⟦class UdsClient⟧ | client UDS | struct + hàm ⟦Uds_…⟧ |
| ⟦namespace uds⟧ | mọi file tester | tiền tố ⟦Uds_⟧, ⟦IsoTp_⟧ |
| ⟦ITransport& m_transport⟧ | client giữ transport | con trỏ không NULL |
| ⟦enum class Session⟧ | Default, Extended | ⟦#define UDS_SESSION_…⟧ |
| ⟦inline constexpr⟧ | ⟦sid::kReadDid⟧ | ⟦#define UDS_SID_READ_DID⟧ |
| ⟦explicit⟧ constructor | ⟦explicit UdsClient(…)⟧ | (không có) chặn ép kiểu ngầm |

**Build (CMake):** ba đích: thư viện ⟦uds_client⟧ (không phụ thuộc ECU), thư viện ⟦ecu_sim⟧ (bọc C++ + ⟦uds_server.c⟧ + ⟦dtc_manager.c⟧), chương trình ⟦uds_tester⟧, và ⟦tester_tests⟧ (GoogleTest).
~~~bash
export PATH="/c/msys64/ucrt64/bin:$PATH"
cmake -S tester -B ../tester_build -G Ninja
cmake --build ../tester_build
ctest --test-dir ../tester_build
../tester_build/uds_tester --sim
~~~`,
              use: `⟦uds_tester --sim⟧ chạy cùng kịch bản regression với tester M5 trên Sensor, nhưng với ECU mô phỏng chứa code C thật.`,
              code: [
                { f: 'tester/include/uds/protocol.hpp', from: 'namespace sid {', to: 'Hard = 0x01,', hl: ['enum class Session : std::uint8_t'],
                  ex: [['inline constexpr std::uint8_t kReadDid          = 0x22;', 'Hằng số có kiểu, thay cho #define.'], ['enum class Session : std::uint8_t', 'Enum có phạm vi, kiểu nền 8 bit: ⟦static_cast<std::uint8_t>(Session::Extended)⟧ = 0x03.']] },
                { f: 'tester/include/uds/uds_client.hpp', from: 'class UdsClient', to: '};', hl: ['explicit UdsClient(ITransport& transport, ClientTiming timing = {});', 'ITransport&  m_transport;'],
                  ex: [['explicit UdsClient(ITransport& transport, ClientTiming timing = {});', 'Constructor nhận transport bằng tham chiếu, timing có giá trị mặc định.'], ['Result<SessionTiming> startSession(Session session);', 'Mỗi service UDS là một method có kiểu trả về riêng.'], ['private:', 'Hai thành viên bên dưới chỉ class này truy cập được.']] },
                { f: 'tester/CMakeLists.txt', from: '# UDS client: hardware independent', to: 'target_compile_options(uds_client PRIVATE ${WARNINGS})', hl: ['add_library(uds_client'] },
              ],
              explain: `⟦UdsClient⟧ chính là phiên bản C++ của một module C: dữ liệu riêng (⟦m_transport⟧, ⟦m_timing⟧) và các hàm công khai. Khác biệt là trình biên dịch **cưỡng chế** quyền truy cập.`,
              run: ['⟦main⟧ tạo ⟦SimulatedEcu ecu;⟧.', '⟦UdsClient client(ecu);⟧: tham chiếu ⟦m_transport⟧ trỏ tới ⟦ecu⟧.', '⟦client.readDid(0xF195)⟧ dựng request, gọi ⟦request()⟧.', 'Kết quả ⟦Result<Bytes>⟧ trả về cho kịch bản.'],
              fig: { type: 'layers', rows: [['uds_tester (app)', ['main()', 'runSimulation()']], ['uds_client (thư viện)', ['UdsClient', 'Result<T>', 'Dtc', 'scenario']], ['ecu_sim (thư viện)', ['SimulatedEcu', 'uds_server.c', 'dtc_manager.c']], ['tester_tests', ['dtc_test', 'uds_client_test', 'simulated_ecu_test']]] },
              video: { t: 'C++ cho người biết C', d: '2:30', goal: 'Đối chiếu từng khái niệm.',
                s: ['class UdsClient cạnh struct + hàm C.', 'namespace thay tiền tố.', 'Tham chiếu như con trỏ không NULL.', 'enum class.', 'Build bằng CMake, chạy --sim.'] },
              pit: [
                ['Dùng lại thư mục ⟦tester/build⟧ có sẵn', 'Cache tạo từ đường dẫn khác, cmake từ chối. Build sang thư mục mới.'],
                ['So sánh ⟦enum class⟧ với số trực tiếp', 'Không biên dịch được: phải ⟦static_cast⟧. Đây là tính năng, không phải lỗi.'],
              ],
              ex: { task: `Build và chạy tester theo lệnh ở phần Lý thuyết. Có bao nhiêu test GoogleTest?`, sol: `29 test (6 trong ⟦dtc_test⟧, 10 trong ⟦simulated_ecu_test⟧, 13 trong ⟦uds_client_test⟧), ctest báo "100% tests passed out of 29".` },
              quiz: [
                ['Tương đương C của ⟦ITransport& m_transport⟧ là gì?', ['Một biến toàn cục', 'Con trỏ không NULL tới đối tượng transport', 'Một bản sao của transport', 'Một enum'], 1, 'Tham chiếu không thể NULL hay đổi chỗ trỏ.'],
                ['Thư viện nào chứa code C của ECU?', ['uds_client', 'ecu_sim', 'uds_tester', 'tester_tests'], 1, '⟦ecu_sim⟧ biên dịch ⟦uds_server.c⟧ và ⟦dtc_manager.c⟧.'],
              ],
              sum: ['class = struct + hàm + quyền truy cập.', 'namespace, enum class, constexpr thay tiền tố và #define.', 'CMake: uds_client, ecu_sim, uds_tester, tester_tests.'],
            },
            {
              id: '13.1.2', t: 'Thư viện chuẩn trong tester: vector, array, span, optional, chrono', min: 25, pre: ['13.1.1'],
              concepts: [
                ['std::vector', 'Mảng động tự quản lý bộ nhớ. ⟦Bytes = std::vector<std::uint8_t>⟧.'],
                ['std::span', 'Cặp (con trỏ, độ dài) không sở hữu dữ liệu. Thay cho ⟦(const uint8_t *data, uint16_t len)⟧.'],
                ['std::optional', 'Có giá trị hoặc không. Thay cho "trả bool + tham số out".'],
                ['std::chrono', 'Kiểu thời gian có đơn vị: ⟦150ms⟧ không thể nhầm với giây.'],
              ],
              goal: `Bạn hiểu từng kiểu thư viện chuẩn trong chữ ký của ⟦ITransport⟧ và ⟦UdsClient⟧, và vì sao chúng an toàn hơn kiểu C tương ứng.`,
              bg: `Phần lớn lỗi trong C đến từ cặp con trỏ/độ dài lệch nhau, giá trị trả về bị quên kiểm, và đơn vị thời gian bị nhầm. Thư viện chuẩn C++ biến các quy ước đó thành kiểu dữ liệu.`,
              th: `| Kiểu | Ở đâu | Thay cho |
|---|---|---|
| ⟦std::vector<uint8_t>⟧ (⟦Bytes⟧) | response, request nhiều DID | mảng + biến độ dài + malloc |
| ⟦std::array<uint8_t, 3>⟧ | request cố định ⟦{0x22, hi, lo}⟧ | ⟦uint8_t req[3]⟧ |
| ⟦std::span<const uint8_t>⟧ | ⟦send(span)⟧, ⟦request(span)⟧ | ⟦(const uint8_t*, len)⟧ |
| ⟦std::optional<Bytes>⟧ | ⟦receive()⟧ | bool + out param |
| ⟦std::chrono::milliseconds⟧ | ⟦ClientTiming⟧, timeout | ⟦uint32_t ms⟧ |
| ⟦std::deque<Bytes>⟧ | hàng đợi response của SimulatedEcu | ring buffer |

**Lưu ý:** tester chạy trên PC/Linux nên dùng ⟦std::vector⟧ (cấp phát động) thoải mái; firmware thì không ([[2.3.1]]). Mỗi môi trường một quy tắc.`,
              use: `⟦request()⟧ nhận ⟦span⟧ nên gọi được với ⟦std::array⟧ (service cố định) lẫn ⟦std::vector⟧ (⟦readDids⟧) mà không cần chép.`,
              code: [
                { f: 'tester/include/uds/transport.hpp', from: 'using Bytes = std::vector<std::uint8_t>;', to: 'virtual std::optional<Bytes> receive(std::chrono::milliseconds timeout) = 0;', hl: ['virtual bool send(std::span<const std::uint8_t> request, Addressing addressing) = 0;'],
                  ex: [['using Bytes = std::vector<std::uint8_t>;', 'Bí danh kiểu dùng khắp tester.'], ['std::span<const std::uint8_t> request', 'Một tham số thay cho cặp con trỏ + độ dài.'], ['std::optional<Bytes> receive(std::chrono::milliseconds timeout)', 'Hết thời gian thì trả "không có gì" (⟦std::nullopt⟧); timeout có đơn vị.']] },
                { f: 'tester/include/uds/uds_client.hpp', from: 'struct ClientTiming', to: 'maxPending = 10;', hl: ['std::chrono::milliseconds p2{150};'],
                  ex: [['std::chrono::milliseconds p2{150};', 'P2 của client lớn hơn P2 của ECU (50 ms) để có dư cho transport và scheduler của PC.'], ['maxPending = 10;', 'Chấp nhận tối đa 10 NRC 0x78 liên tiếp.']] },
                { f: 'tester/src/uds_client.cpp', from: 'Result<Bytes> UdsClient::readDid(std::uint16_t id)', to: 'return Bytes(b.begin() + 3, b.end());', hl: ['const std::array<std::uint8_t, 3> req{sid::kReadDid,'],
                  ex: [['const std::array<std::uint8_t, 3> req{sid::kReadDid,', 'Request 3 byte trên stack, truyền như span.'], ['return Bytes(b.begin() + 3, b.end());', 'Trả phần dữ liệu sau DID bằng một vector mới.']] },
              ],
              explain: `Chữ ký ⟦optional<Bytes> receive(milliseconds)⟧ tự giải thích: có thể không có kết quả, có kết quả thì là một dãy byte, thời gian chờ tính bằng ms. Trong C cần một đoạn comment để nói cùng điều đó.`,
              run: ['⟦readDid(0xF195)⟧ dựng ⟦std::array⟧ 3 byte.', '⟦request(req)⟧ nhận như ⟦span⟧, gọi ⟦m_transport.send(req, …)⟧.', '⟦m_transport.receive(150ms)⟧ trả ⟦optional<Bytes>⟧.', 'Có giá trị → kiểm SID, trả dữ liệu; không có → ⟦Error::Timeout⟧.'],
              fig: { type: 'layers', rows: [['C (firmware)', ['const uint8_t *data, uint16_t len', 'bool + out param', 'uint32_t ms', 'mảng tĩnh']], ['C++ (tester)', ['std::span<const uint8_t>', 'std::optional<Bytes>', 'std::chrono::milliseconds', 'std::vector / std::array']]] },
              video: { t: 'Chữ ký hàm tự giải thích', d: '1:45', goal: 'Đọc kiểu thay vì đọc comment.',
                s: ['receive() bản C: bool + out param + uint32_t.', 'receive() bản C++: optional + chrono.', 'span thay cặp con trỏ/độ dài.', 'array vs vector: khi nào dùng cái nào.'] },
              pit: [
                ['Giữ ⟦span⟧ lâu hơn dữ liệu nó trỏ tới', 'span không sở hữu dữ liệu; vector bị hủy thì span trỏ vào vùng nhớ chết.'],
                ['Truy cập ⟦*optional⟧ mà không kiểm', 'Hành vi không xác định nếu rỗng. Code luôn ⟦if (!response) return Error{Timeout}⟧ trước.'],
              ],
              ex: { task: `Trong {{tester/src/uds_client.cpp@Result<std::vector<Dtc>> UdsClient::readDtcs}}, tìm chỗ dùng ⟦std::span(b).subspan(3)⟧. Nó làm gì và có chép dữ liệu không?`, sol: `Tạo một span nhìn vào phần response sau 3 byte đầu (⟦59 02 mask⟧) để ⟦parseDtcRecords⟧ đọc; không chép dữ liệu.` },
              quiz: [
                ['⟦std::optional<Bytes>⟧ trả về khi hết thời gian chờ là gì?', ['Vector rỗng', 'std::nullopt', 'Exception', 'Bytes{0}'], 1, 'Không có giá trị.'],
                ['Vì sao tester được dùng ⟦std::vector⟧ còn firmware không dùng malloc?', ['Vì C++ nhanh hơn', 'Vì tester chạy trên PC/Linux, firmware an toàn cần bộ nhớ tĩnh', 'Vì vector không cấp phát', 'Không có lý do'], 1, 'Quy tắc theo môi trường.'],
              ],
              sum: ['span = (con trỏ, độ dài) không sở hữu.', 'optional = có hoặc không có giá trị.', 'chrono = thời gian có đơn vị.', 'vector cho tester; firmware giữ bộ nhớ tĩnh.'],
            },
          ],
        },
        {
          id: '13.2', t: 'OOP trong tester: phân tích từ code thật',
          subs: [
            {
              id: '13.2.1', t: 'Abstraction và polymorphism: interface ITransport', min: 30, pre: ['13.1.2'],
              concepts: [
                ['Abstraction', 'Chỉ lộ ra "cái gì" (gửi, nhận một message) và giấu "làm thế nào" (ISO-TP, RPMsg, gọi thẳng C).'],
                ['Hàm ảo thuần (= 0)', 'Method không có cài đặt; class con bắt buộc cài đặt. Class có hàm ảo thuần là interface.'],
                ['Polymorphism', 'Cùng lời gọi ⟦m_transport.send()⟧ chạy code khác nhau tùy đối tượng thật.'],
                ['Dependency Inversion', 'Client phụ thuộc vào interface, không vào class cụ thể (chữ D của SOLID).'],
              ],
              goal: `Bạn chỉ ra được abstraction và polymorphism trong code thật, và thấy đây chính là con trỏ hàm của ⟦IsoTp_Config_t⟧ viết theo kiểu C++.`,
              bg: `Ở [[2.2.2]] bạn đã thấy ISO-TP nhận ⟦sendFrame⟧ qua con trỏ hàm để chạy được với driver thật hoặc giả. C++ có cơ chế sẵn cho việc đó: **hàm ảo**. Trình biên dịch tự tạo "bảng con trỏ hàm" (vtable) cho mỗi class.`,
              th: `⟦ITransport⟧ có hai hàm ảo thuần: ⟦send(span, Addressing)⟧ và ⟦receive(milliseconds)⟧. Một message mỗi lần gọi; tách khung (ISO-TP trên CAN, đóng khung trên RPMsg) là việc của class cụ thể.

**Ba cài đặt:**
| Class | Ở đâu | Làm gì |
|---|---|---|
| ⟦SimulatedEcu⟧ | ⟦tester/src⟧ | gọi thẳng ⟦Uds_ProcessRequest⟧ của code C thật |
| ⟦ScriptedTransport⟧ | ⟦tester/tests⟧ | trả response soạn sẵn, ghi lại request đã gửi |
| ⟦RpmsgTransport⟧ | (dự kiến) | đọc/ghi ⟦/dev/ttyRPMSG0⟧ trên DK1 |

⟦UdsClient⟧ chỉ biết ⟦ITransport&⟧. Không sửa một dòng nào của client khi đổi từ mô phỏng sang phần cứng thật: đó là **Dependency Inversion** và **Open/Closed** (mở để mở rộng bằng class mới, đóng với sửa đổi).

Destructor ảo ⟦virtual ~ITransport() = default⟧ để hủy đúng class con qua con trỏ lớp cha. Copy constructor để ⟦protected⟧ để không ai copy nhầm một ⟦ITransport⟧ trần.`,
              use: `⟦runRegressionScenario(UdsClient&)⟧ chạy y hệt trên ⟦SimulatedEcu⟧ (trong ⟦--sim⟧ và GoogleTest), và sau này trên ⟦RpmsgTransport⟧.`,
              code: [
                { f: 'tester/include/uds/transport.hpp', from: 'class ITransport', to: '};', hl: ['virtual ~ITransport() = default;', 'virtual bool send(std::span<const std::uint8_t> request, Addressing addressing) = 0;'],
                  ex: [['virtual ~ITransport() = default;', 'Destructor ảo: bắt buộc cho class dùng đa hình.'], ['= 0;', 'Hàm ảo thuần: ITransport không tự tạo đối tượng được.'], ['protected:', 'Constructor/copy ở protected: chỉ class con dùng được.']] },
                { f: 'tester/include/uds/simulated_ecu.hpp', from: 'class SimulatedEcu final : public ITransport', n: 12, hl: ['class SimulatedEcu final : public ITransport', 'bool send(std::span<const std::uint8_t> request, Addressing addressing) override;'],
                  ex: [['class SimulatedEcu final : public ITransport', 'Kế thừa public từ interface; ⟦final⟧: không ai kế thừa tiếp.'], ['override;', '⟦override⟧ bắt trình biên dịch kiểm tra đúng là ghi đè một hàm ảo.']] },
                { f: 'tester/tests/uds_client_test.cpp', from: 'class ScriptedTransport final : public ITransport', to: 'bool                                   sendOk         = true;', hl: ['sent.emplace_back(request.begin(), request.end());'],
                  ex: [['sent.emplace_back(request.begin(), request.end());', 'Ghi lại mọi request để test kiểm byte gửi đi.'], ['timeouts.push_back(timeout);', 'Ghi lại timeout client dùng: test kiểm P2 rồi P2* sau NRC 0x78.']] },
              ],
              explain: `So ⟦ScriptedTransport⟧ (C++) với ⟦FakeSend⟧ trong ⟦test_isotp.c⟧ (C): cùng ý tưởng test double, một bên dùng con trỏ hàm, một bên dùng hàm ảo.`,
              run: ['Test tạo ⟦ScriptedTransport link⟧, nạp ⟦link.responses⟧.', '⟦UdsClient client{link, …}⟧.', '⟦client.readDid(0xF195)⟧ gọi ⟦m_transport.send()⟧ → vtable → ⟦ScriptedTransport::send⟧.', '⟦m_transport.receive()⟧ → ⟦ScriptedTransport::receive⟧ trả response soạn sẵn.', 'Test kiểm ⟦link.sent[0] == {0x22, 0xF1, 0x95}⟧.'],
              fig: { type: 'layers', rows: [['Interface', ['ITransport: send() = 0, receive() = 0']], ['Cài đặt', ['SimulatedEcu final', 'ScriptedTransport final (test)', 'RpmsgTransport (dự kiến)']], ['Người dùng', ['UdsClient (giữ ITransport&)', 'runRegressionScenario()', 'runResetScenario()']]] },
              video: { t: 'Một client, ba transport', d: '2:30', goal: 'Abstraction và polymorphism.',
                s: ['Interface ITransport hai hàm.', 'SimulatedEcu gọi code C thật.', 'ScriptedTransport trả response soạn sẵn.', 'RpmsgTransport: thêm class mới, client không đổi.', 'So với con trỏ hàm trong IsoTp_Config_t.'] },
              pit: [
                ['Quên ⟦virtual⟧ ở destructor của interface', 'Hủy qua con trỏ lớp cha sẽ bỏ qua destructor lớp con: rò rỉ hoặc hành vi không xác định.'],
                ['Quên ⟦override⟧', 'Gõ sai chữ ký sẽ tạo hàm mới thay vì ghi đè; ⟦override⟧ biến lỗi này thành lỗi biên dịch.'],
              ],
              ex: { task: `Phác thảo (trên giấy) class ⟦LoggingTransport⟧ bọc một ⟦ITransport&⟧ khác và in hex mỗi lần gửi/nhận. Nó thuộc design pattern nào?`, sol: `⟦class LoggingTransport final : public ITransport { ITransport& m_inner; … send() { in "→ " + hexDump(request); return m_inner.send(…); } receive() { auto r = m_inner.receive(t); if (r) in "← " + hexDump(*r); return r; } };⟧ Đây là pattern **Decorator**: thêm hành vi mà không sửa class gốc.` },
              quiz: [
                ['⟦= 0⟧ sau một hàm ảo nghĩa là gì?', ['Hàm trả về 0', 'Hàm ảo thuần, class con bắt buộc cài đặt', 'Hàm bị xóa', 'Hàm inline'], 1, 'Biến ITransport thành interface.'],
                ['Nguyên tắc SOLID nào thể hiện rõ nhất qua ⟦UdsClient(ITransport&)⟧?', ['Single Responsibility', 'Liskov', 'Dependency Inversion', 'Interface Segregation'], 2, 'Client phụ thuộc abstraction, không phụ thuộc class cụ thể.'],
              ],
              sum: ['ITransport = abstraction của "gửi/nhận một message".', '3 cài đặt; client không đổi: polymorphism + DIP.', 'Destructor ảo, override, final.', 'Cùng ý tưởng với con trỏ hàm trong C.'],
            },
            {
              id: '13.2.2', t: 'Encapsulation và RAII: SimulatedEcu, UdsClient, Dtc', min: 25, pre: ['13.2.1'],
              concepts: [
                ['Encapsulation', 'Dữ liệu private, chỉ thay đổi được qua method; bất biến của đối tượng luôn đúng.'],
                ['RAII', 'Resource Acquisition Is Initialization: tài nguyên được lấy trong constructor và trả trong destructor.'],
                ['Cấm copy (= delete)', 'Đối tượng đại diện cho tài nguyên duy nhất không được sao chép.'],
              ],
              goal: `Bạn thấy encapsulation và RAII trong ba class thật, và hiểu vì sao ⟦SimulatedEcu⟧ cấm copy và chỉ cho một instance.`,
              bg: `Trong C, "đóng gói" dựa vào ⟦static⟧ và kỷ luật. C++ cho trình biên dịch cưỡng chế: thành viên private không truy cập được từ ngoài, constructor/destructor tự chạy.`,
              th: `**SimulatedEcu:**
- Thành viên private: hàng đợi response, mảng lỗi, đồng hồ mô phỏng, reset đang chờ, bộ đếm reset.
- Constructor: kiểm chưa có instance nào (⟦s_active == nullptr⟧), đăng ký ⟦s_active = this⟧, "bật nguồn" ECU (init DTC manager và UDS server).
- Destructor: ⟦s_active = nullptr⟧. Đây là RAII: thời gian sống của đối tượng = thời gian ECU mô phỏng "đang chạy".
- Copy bị ⟦= delete⟧: hai bản sao sẽ cùng trỏ vào trạng thái static của code C.

**UdsClient:** hai thành viên private (⟦m_transport⟧, ⟦m_timing⟧); mọi thao tác qua method.

**Dtc (struct):** dữ liệu public (code, status) kèm method chỉ đọc ⟦testFailed()⟧, ⟦pending()⟧, ⟦confirmed()⟧ và ⟦operator==⟧ mặc định. Struct cho dữ liệu đơn giản, class cho đối tượng có bất biến.`,
              use: `Test ⟦SimulatedEcuLifetime.OnlyOneInstance⟧ kiểm rằng tạo instance thứ hai ném ⟦std::logic_error⟧.`,
              code: [
                { f: 'tester/src/simulated_ecu.cpp', from: 'SimulatedEcu::SimulatedEcu()', to: 's_active = nullptr;', hl: ['throw std::logic_error("only one SimulatedEcu may exist at a time");', 's_active = nullptr;'],
                  ex: [['if (s_active != nullptr)', 'Bất biến: chỉ một ECU mô phỏng vì code C dùng biến static.'], ['powerOn();', 'Constructor đưa đối tượng vào trạng thái hợp lệ ngay.'], ['s_active = nullptr;', 'Destructor trả "tài nguyên" (quyền dùng code C) khi đối tượng hết phạm vi.']] },
                { f: 'tester/include/uds/simulated_ecu.hpp', from: 'SimulatedEcu(const SimulatedEcu&) = delete;', n: 2, hl: ['SimulatedEcu(const SimulatedEcu&) = delete;'] },
                { f: 'tester/include/uds/dtc.hpp', from: 'struct Dtc', to: '};', hl: ['bool confirmed() const noexcept'],
                  ex: [['bool testFailed() const noexcept', '⟦const⟧: không đổi đối tượng; ⟦noexcept⟧: không ném exception.'], ['friend bool operator==(const Dtc&, const Dtc&) = default;', 'So sánh từng thành viên do trình biên dịch sinh (C++20).']] },
              ],
              explain: `Exception chỉ được dùng ở **một chỗ**: lỗi lập trình (tạo hai SimulatedEcu). Lỗi giao tiếp UDS dùng ⟦Result⟧ ([[13.2.3]]). Phân biệt "lỗi của người lập trình" với "kết quả có thể xảy ra" là một quyết định thiết kế.`,
              run: ['Trong một hàm: ⟦SimulatedEcu ecu;⟧ → constructor: kiểm, đăng ký, bật nguồn.', 'Dùng ⟦ecu⟧ qua ⟦UdsClient⟧.', 'Hết phạm vi → destructor tự chạy → ⟦s_active = nullptr⟧.', 'Lần sau tạo ⟦SimulatedEcu⟧ mới vẫn được.'],
              fig: { type: 'flow', nodes: [['SimulatedEcu ecu; (vào phạm vi)', 'start'], ['s_active đã có? → throw logic_error', 'bad'], 's_active = this; powerOn(): DtcMgr_Init, Uds_Init', 'Sử dụng: send(), receive(), reportMonitor()', ['Ra khỏi phạm vi → ~SimulatedEcu(): s_active = nullptr', 'end']] },
              video: { t: 'RAII: constructor lấy, destructor trả', d: '1:45', goal: 'Vòng đời của SimulatedEcu.',
                s: ['Đối tượng sinh ra: đăng ký s_active.', 'Thử tạo cái thứ hai: exception.', 'Ra khỏi khối {}: destructor chạy.', 'Vì sao cấm copy.'] },
              pit: [
                ['Cho phép copy đối tượng sở hữu tài nguyên duy nhất', 'Hai bản sao cùng điều khiển một trạng thái static: kết quả khó đoán. ⟦= delete⟧ chặn từ lúc biên dịch.'],
                ['Quên reset ⟦s_active⟧ trong destructor', 'Test sau sẽ báo "only one SimulatedEcu" dù cái trước đã hết.'],
              ],
              ex: { task: `Vì sao ⟦Dtc⟧ là ⟦struct⟧ với thành viên public, còn ⟦UdsClient⟧ là ⟦class⟧ với thành viên private?`, sol: `⟦Dtc⟧ chỉ là dữ liệu (mã + status), không có bất biến cần bảo vệ: mọi tổ hợp giá trị đều hợp lệ. ⟦UdsClient⟧ giữ tham chiếu transport và timing mà người dùng không nên đổi giữa chừng, nên giấu đi.` },
              quiz: [
                ['RAII trong SimulatedEcu thể hiện ở đâu?', ['Trong send()', 'Constructor đăng ký s_active, destructor xóa', 'Trong operator==', 'Trong CMake'], 1, 'Vòng đời đối tượng = vòng đời tài nguyên.'],
                ['Vì sao SimulatedEcu chỉ cho một instance?', ['Để tiết kiệm RAM', 'Vì uds_server.c và dtc_manager.c giữ trạng thái trong biến static', 'Vì CMake', 'Vì GoogleTest'], 1, 'Comment trong ⟦simulated_ecu.hpp⟧.'],
              ],
              sum: ['Encapsulation: private + method.', 'RAII: constructor lấy, destructor trả.', 'Cấm copy tài nguyên duy nhất.', 'Exception cho lỗi lập trình; Result cho kết quả UDS.'],
            },
            {
              id: '13.2.3', t: 'Result<T>: lỗi là giá trị, không phải exception', min: 25, pre: ['13.2.2'],
              concepts: [
                ['std::variant<T, Error>', 'Kiểu chứa đúng một trong hai: giá trị hoặc lỗi.'],
                ['Template', 'Viết một lần ⟦Result<T>⟧ dùng cho mọi T: ⟦Result<Bytes>⟧, ⟦Result<SessionTiming>⟧…'],
                ['std::monostate', 'Kiểu "không có gì", dùng cho ⟦Status = Result<monostate>⟧ khi thành công không trả dữ liệu.'],
                ['Constructor ngầm', 'Cho phép ⟦return Error{…};⟧ hoặc ⟦return value;⟧ trực tiếp trong hàm trả Result.'],
              ],
              goal: `Bạn đọc hiểu ⟦result.hpp⟧ (56 dòng), dùng được ⟦Result⟧ trong code mới, và giải thích vì sao NRC không được ném như exception.`,
              bg: `Trong chẩn đoán, response âm là **kết quả bình thường**: tester thường cố ý gửi request sai để kiểm ECU từ chối đúng (NRC 0x7E khi reset ở default). Dùng exception cho những trường hợp đó vừa chậm vừa che khuất luồng chương trình.`,
              th: `⟦Error⟧ có 4 loại: ⟦Timeout⟧ (không có response trong P2/P2*), ⟦Negative⟧ (kèm NRC), ⟦Malformed⟧ (response không khớp request), ⟦SendFailed⟧. Method ⟦isNrc(code)⟧ và ⟦describe()⟧.

⟦Result<T>⟧ bọc ⟦std::variant<T, Error>⟧:
- ⟦ok()⟧ / ⟦explicit operator bool⟧: có giá trị không.
- ⟦value()⟧, ⟦error()⟧: lấy ra (⟦std::get⟧ sẽ ném nếu lấy sai loại, nên luôn kiểm ⟦ok()⟧ trước).
- Hai constructor **cố ý không explicit** để ⟦return Error{Error::Kind::Timeout};⟧ và ⟦return values;⟧ đều tự chuyển thành Result.

Mẫu dùng trong client: ⟦auto r = request(req); if (!r) return r.error(); …⟧ (lỗi tầng dưới được chuyển lên nguyên vẹn).

**So sánh với C:** firmware trả enum (⟦IsoTp_Result_t⟧) hoặc NRC; Result là phiên bản có kiểu, gói luôn giá trị thành công.`,
              use: `Kịch bản regression dùng ⟦expectOk⟧ / ⟦expectNrc⟧ / ⟦expectSilence⟧ trên các Result để chấm PASS/FAIL ([[13.2.5]]).`,
              code: [
                { f: 'tester/include/uds/result.hpp', from: 'struct Error', to: 'using Status = Result<std::monostate>;', hl: ['std::variant<T, Error> m_value;', 'Result(Error error) : m_value(error) {}           // NOLINT: implicit on purpose'],
                  ex: [['bool isNrc(std::uint8_t code) const noexcept', 'Tiện kiểm "có phải NRC 0x7E không" trong test.'], ['template <typename T>', 'Một định nghĩa cho mọi kiểu giá trị.'], ['// NOLINT: implicit on purpose', 'Constructor ngầm là cố ý; comment báo cho công cụ lint và người đọc.'], ['using Status = Result<std::monostate>;', 'Kết quả không có dữ liệu (ecuReset, clearAllDtcs).']] },
                { f: 'tester/src/uds_client.cpp', from: 'Result<Bytes> UdsClient::request(std::span<const std::uint8_t> req, Addressing addressing)', n: 40, hl: ['timeout = m_timing.p2Star;   // ECU needs more time: wait for the final response', 'return Error{Error::Kind::Negative, r[2]};'],
                  ex: [['return Error{Error::Kind::SendFailed};', 'Transport từ chối gửi.'], ['return Error{Error::Kind::Timeout};', 'Không có response trong thời gian chờ.'], ['timeout = m_timing.p2Star;   // ECU needs more time: wait for the final response', 'NRC 0x78: đổi sang chờ P2* và tiếp tục vòng lặp.'], ['return Error{Error::Kind::Negative, r[2]};', 'NRC khác: trả lỗi kèm mã.']] },
              ],
              explain: `Vòng ⟦for⟧ trong ⟦request()⟧ là cách client chịu NRC 0x78 (ECU xin thêm thời gian): tối đa ⟦maxPending⟧ lần, mỗi lần chờ P2*. Server của project chưa gửi 0x78, nhưng client đã sẵn sàng và có test (⟦ResponsePendingSwitchesToP2Star⟧).`,
              run: ['⟦ecuReset(Hard)⟧ ở default session.', '⟦request({11 01})⟧ → transport → response ⟦7F 11 7E⟧.', 'Là NRC, không phải 0x78 → ⟦Error{Negative, 0x7E}⟧.', '⟦ecuReset⟧ thấy ⟦!r⟧ → ⟦return r.error();⟧.', 'Kịch bản: ⟦expectNrc(…, Nrc::SubFunctionNotSupportedInSession)⟧ → PASS.'],
              fig: { type: 'flow', nodes: [['request(req)', 'start'], ['send thất bại → Error::SendFailed', 'bad'], ['receive hết thời gian → Error::Timeout', 'bad'], ['7F SID 78 → chờ tiếp với P2* (≤ maxPending lần)', 'dec'], ['7F SID NRC → Error::Negative(NRC)', 'bad'], ['byte 0 = SID + 0x40 → Result chứa Bytes', 'ok'], ['Khác → Error::Malformed', 'end']] },
              video: { t: 'Lỗi là một giá trị', d: '2:00', goal: 'Result<T> và lý do không dùng exception.',
                s: ['NRC là kết quả mong đợi trong test chẩn đoán.', 'variant<T, Error>: hộp chứa một trong hai.', 'return Error{...} và return value đều được.', 'Chuỗi if (!r) return r.error().', 'NRC 0x78 và P2*.'] },
              pit: [
                ['Gọi ⟦value()⟧ khi ⟦ok()⟧ là false', '⟦std::get⟧ ném ⟦bad_variant_access⟧. Luôn kiểm trước.'],
                ['Dùng exception cho NRC', 'Test reset-ở-default sẽ phải ⟦try/catch⟧ cho một kết quả bình thường; luồng code khó đọc.'],
              ],
              ex: { task: `Viết (trên giấy) method ⟦Result<std::uint16_t> readSpeedX10()⟧ cho UdsClient dùng ⟦readDid⟧.`, sol: `⟦auto r = readDid(0x0100); if (!r) return r.error(); if (r.value().size() != 2U) return Error{Error::Kind::Malformed}; return static_cast<std::uint16_t>((r.value()[0] << 8) | r.value()[1]);⟧` },
              quiz: [
                ['⟦Status⟧ là gì?', ['Một enum', 'Result<std::monostate>: thành công không có dữ liệu hoặc lỗi', 'Một exception', 'Một struct DTC'], 1, 'Dùng cho clearAllDtcs, ecuReset, testerPresent.'],
                ['Client làm gì khi nhận ⟦7F 22 78⟧?', ['Trả Error::Negative 0x78', 'Đổi sang chờ P2* và tiếp tục chờ response cuối', 'Gửi lại request', 'Ném exception'], 1, 'responsePending.'],
              ],
              sum: ['Result<T> = variant<T, Error>.', '4 loại lỗi: Timeout, Negative, Malformed, SendFailed.', 'Lỗi chuyển lên bằng ⟦if (!r) return r.error()⟧.', 'Exception chỉ cho lỗi lập trình.'],
            },
            {
              id: '13.2.4', t: 'Gọi code C từ C++: extern "C", callback static và s_active', min: 25, pre: ['13.2.2', '9.1.6'],
              concepts: [
                ['extern "C"', 'Báo trình biên dịch C++ rằng các hàm khai báo bên trong dùng quy ước liên kết C (không name mangling).'],
                ['Name mangling', 'C++ mã hóa kiểu tham số vào tên ký hiệu; C không. Thiếu extern "C" là lỗi liên kết.'],
                ['Callback static', 'Hàm thành viên static có địa chỉ như hàm C thường, gán được vào con trỏ hàm của C.'],
                ['s_active', 'Con trỏ static tới instance đang chạy, để callback static tìm lại đối tượng.'],
              ],
              goal: `Bạn hiểu chính xác cách tester C++ tái sử dụng ⟦uds_server.c⟧ và ⟦dtc_manager.c⟧: liên kết, callback, và giới hạn một instance.`,
              bg: `Code C cũ (hay code firmware) thường cần được dùng lại trong C++. Hai vấn đề: tên ký hiệu khác nhau giữa C và C++, và callback của C không mang theo ⟦this⟧.`,
              th: `**1. Liên kết:** ⟦extern "C" { #include "dtc_manager.h" … }⟧ để các lời gọi ⟦Uds_ProcessRequest⟧, ⟦DtcMgr_Init⟧… tìm đúng ký hiệu C.

**2. Callback:** ⟦Uds_Config_t⟧ cần con trỏ hàm C (⟦getTimeMs⟧, ⟦ecuReset⟧, các hàm đọc DID). Method thường của C++ cần ⟦this⟧ nên không gán được. Giải pháp: method **static** (⟦cbGetTimeMs⟧, ⟦cbEcuReset⟧, ⟦cbReadSpeed⟧…) và con trỏ ⟦s_active⟧ trỏ tới instance hiện tại.

**3. Vì sao không dùng ⟦ctx⟧?** ISO-TP có ⟦void *ctx⟧ trong mọi callback, nhưng ⟦Uds_Config_t⟧ và ⟦Uds_Did_t⟧ thì không. Không sửa được C mà không đổi firmware, nên tester chấp nhận giới hạn một instance và cưỡng chế nó ([[13.2.2]]).

**4. Mô phỏng đúng hành vi ECU:** ⟦send()⟧ gọi ⟦Uds_ProcessRequest⟧, đẩy response vào hàng đợi, rồi gọi ⟦Uds_ExecutePendingReset⟧: reset chạy sau response, như trên M4. Hard reset gọi ⟦powerOn()⟧ lại, DTC mất như thật.`,
              use: `Nếu sau này thêm ⟦ctx⟧ vào ⟦Uds_Config_t⟧, tester bỏ được ⟦s_active⟧ và cho nhiều ECU mô phỏng cùng lúc. Đó là một cải tiến thiết kế đáng nêu.`,
              code: [
                { f: 'tester/src/simulated_ecu.cpp', from: 'extern "C" {', to: '}', hl: ['extern "C" {'],
                  ex: [['extern "C" {', 'Header C được include trong khối liên kết C.']] },
                { f: 'tester/src/simulated_ecu.cpp', from: 'bool SimulatedEcu::send(std::span<const std::uint8_t> request, Addressing addressing)', to: 'return true;', after: 'void SimulatedEcu::powerOn()', hl: ['Uds_ProcessRequest(request.data(), static_cast<std::uint16_t>(request.size()),', 'Uds_ExecutePendingReset();'],
                  ex: [['Bytes            response(kMaxResponseLen);', 'Buffer 4095 byte (giới hạn ISO-TP), cắt bớt sau khi biết độ dài.'], ['addressing == Addressing::Functional', 'Enum class đổi thành bool cho API C.'], ['// As on the ECU: the reset runs only after its response has been sent.', 'Giữ đúng thứ tự như firmware.'], ['powerOn();', 'Hard reset: khởi tạo lại DTC và UDS, DTC mất.']] },
                { f: 'tester/src/simulated_ecu.cpp', from: 'std::uint32_t SimulatedEcu::cbGetTimeMs()', to: 'out[1] = static_cast<std::uint8_t>(s_active->m_speedX10 & 0xFFU);', hl: ['return s_active->m_nowMs;'],
                  ex: [['return s_active->m_nowMs;', 'Callback static tìm lại đối tượng qua ⟦s_active⟧.'], ['s_active->m_pendingReset = type;', 'Ghi lại reset để ⟦send()⟧ xử lý sau.']] },
              ],
              explain: `Mẫu "callback static + con trỏ instance static" là cách phổ biến khi bọc API C không có tham số ngữ cảnh. Nó đúng nhưng có giá: chỉ một instance, không an toàn đa luồng.`,
              run: ['⟦client.request({22 01 00})⟧ → ⟦SimulatedEcu::send⟧.', '⟦Uds_ProcessRequest⟧ (C) → ⟦ReadDid⟧ → con trỏ ⟦cbReadSpeed⟧.', '⟦cbReadSpeed⟧ (static) → ⟦s_active->m_speedX10⟧ → ghi 2 byte.', 'Response ⟦62 01 00 HI LO⟧ vào ⟦m_responses⟧.', '⟦receive()⟧ lấy ra trả cho client.'],
              fig: { type: 'seq', actors: ['UdsClient', 'SimulatedEcu::send', 'uds_server.c', 'cbReadSpeed (static)', 's_active'], msgs: [[0, 1, 'send(22 01 00)'], [1, 2, 'Uds_ProcessRequest'], [2, 3, 'did->read(out)'], [3, 4, 'đọc m_speedX10'], [3, 2, '2 byte'], [2, 1, '62 01 00 HI LO'], [1, 1, 'm_responses.push_back'], [0, 1, 'receive() → response']] },
              video: { t: 'C++ bọc code C', d: '2:00', goal: 'extern "C" và callback static.',
                s: ['Thiếu extern "C": lỗi liên kết, tên bị mangle.', 'Method thường không gán vào con trỏ hàm C.', 'Method static + s_active.', 'Giới hạn: một instance.', 'Cải tiến: thêm ctx vào Uds_Config_t.'] },
              pit: [
                ['Include header C trong file C++ không có ⟦extern "C"⟧', 'Liên kết thất bại vì trình biên dịch tìm tên đã mangle.'],
                ['Tạo hai SimulatedEcu trong cùng test', 'Cả hai dùng chung trạng thái static của C; constructor ném exception để chặn.'],
              ],
              ex: { task: `Đề xuất thay đổi tối thiểu trong ⟦uds_server.h⟧ để tester bỏ được ⟦s_active⟧. Ảnh hưởng tới firmware thế nào?`, sol: `Thêm ⟦void *ctx⟧ vào ⟦Uds_Config_t⟧ và truyền nó vào ⟦getTimeMs(ctx)⟧, ⟦ecuReset(ctx, type)⟧, ⟦read(ctx, out)⟧. Firmware phải sửa chữ ký các callback trong ⟦diag_app.c⟧ (truyền NULL là đủ). Muốn nhiều instance thật thì trạng thái static trong ⟦uds_server.c⟧ cũng phải chuyển vào một struct do caller giữ.` },
              quiz: [
                ['Vì sao ⟦cbReadSpeed⟧ phải là method static?', ['Cho nhanh', 'Để có địa chỉ như hàm C thường, gán được vào con trỏ hàm của Uds_Did_t', 'Vì MISRA', 'Vì const'], 1, 'Method thường cần this.'],
                ['Thiếu ⟦extern "C"⟧ khi include ⟦uds_server.h⟧ gây lỗi gì?', ['Lỗi cú pháp', 'Lỗi liên kết (undefined reference) do name mangling', 'Lỗi lúc chạy', 'Không lỗi'], 1, 'Ký hiệu C++ khác ký hiệu C.'],
              ],
              sum: ['extern "C" cho liên kết đúng.', 'Callback static + s_active thay cho ctx.', 'Hệ quả: chỉ một instance.', 'SimulatedEcu giữ đúng thứ tự response trước, reset sau.'],
            },
            {
              id: '13.2.5', t: 'Kế thừa, SOLID và design pattern: có gì và không có gì', min: 25, pre: ['13.2.1', '13.2.3'],
              concepts: [
                ['Kế thừa', 'Class con nhận giao diện/cài đặt của class cha. Tester chỉ dùng kế thừa từ interface, một tầng.'],
                ['Composition', 'Đối tượng chứa hoặc tham chiếu đối tượng khác (UdsClient có ITransport&). Ưu tiên hơn kế thừa.'],
                ['Test double', 'Đối tượng giả thay cho phụ thuộc thật khi test (ScriptedTransport, FakeSend).'],
                ['Template member + lambda', '⟦Recorder::expectOk⟧ nhận một lambda để mô tả kết quả thành chữ.'],
              ],
              goal: `Bạn đánh giá được thiết kế hướng đối tượng của tester một cách trung thực: nguyên tắc nào được áp dụng, pattern nào xuất hiện, và đặc tính nào cố ý không dùng.`,
              bg: `Phỏng vấn hay hỏi "project có dùng OOP/SOLID/design pattern không". Câu trả lời tốt dựa trên code thật và dám nói "không dùng" khi đúng là không.`,
              th: `**Kế thừa:** chỉ một tầng, từ interface: ⟦SimulatedEcu : ITransport⟧, ⟦ScriptedTransport : ITransport⟧ (cả hai ⟦final⟧). Ngoài ra các fixture test (⟦SimulatedEcuTest⟧, ⟦UdsClientTest⟧) kế thừa ⟦::testing::Test⟧ vì GoogleTest yêu cầu. Không có cây kế thừa nhiều tầng, không có class cha có cài đặt được dùng lại. Đây là lựa chọn tốt: composition (⟦UdsClient⟧ giữ ⟦ITransport&⟧) thay vì kế thừa.

**SOLID:**
| Nguyên tắc | Có không | Ở đâu |
|---|---|---|
| S – một trách nhiệm | Có | ⟦UdsClient⟧ chỉ dựng/giải mã UDS; transport lo vận chuyển; ⟦dtc.cpp⟧ lo định dạng DTC |
| O – mở/đóng | Có | thêm transport mới không sửa client |
| L – thay thế Liskov | Có | mọi ITransport dùng được ở chỗ client cần |
| I – tách interface | Có (nhỏ tự nhiên) | ITransport chỉ 2 hàm |
| D – đảo phụ thuộc | Có | client phụ thuộc ITransport |

**Design pattern thật sự có:**
- **Strategy / Dependency Injection:** transport được truyền vào client (C++), con trỏ hàm trong ⟦IsoTp_Config_t⟧ (C).
- **Adapter:** ⟦SimulatedEcu⟧ chuyển API C của UDS server thành interface ⟦ITransport⟧.
- **Test double (fake/stub):** ⟦ScriptedTransport⟧, ⟦FakeSend⟧, ⟦FakeTime⟧.
- **State machine:** ISO-TP, tester_app, debounce (C).
- **Collecting parameter:** ⟦Recorder⟧ gom kết quả từng bước vào ⟦ScenarioReport⟧.

**Không có** (đừng gán ghép): Factory, Singleton đúng nghĩa (SimulatedEcu chỉ chặn instance thứ hai), Observer, Visitor, kế thừa đa tầng.`,
              use: `⟦Recorder⟧ trong {{tester/src/scenario.cpp}} dùng template member function và lambda để mỗi bước kịch bản chỉ một dòng.`,
              code: [
                { f: 'tester/src/scenario.cpp', from: '/** Collects step results; each helper states what the step expects. */', to: 'void expectSilence(std::string name, const Result<T>& r)', hl: ['void expectOk(std::string name, const Result<T>& r, Describe describe)', 'const bool pass = !r.ok() && r.error().isNrc(static_cast<std::uint8_t>(nrc));'],
                  ex: [['explicit Recorder(ScenarioReport& report) : m_report(report) {}', 'Giữ tham chiếu tới báo cáo: mỗi expect thêm một bước vào đó.'], ['template <typename T, typename Describe>', 'Template theo kiểu Result và kiểu hàm mô tả (thường là lambda).'], ['add(std::move(name), r.ok(), r.ok() ? describe(r.value()) : r.error().describe());', 'Thành công: mô tả dữ liệu; thất bại: mô tả lỗi.'], ['const bool pass = !r.ok() && r.error().isNrc(static_cast<std::uint8_t>(nrc));', 'Bước "mong đợi NRC" PASS khi đúng là NRC đó.']] },
                { f: 'tester/src/dtc.cpp', from: 'std::string summarizeStatus(std::uint8_t status)', to: 'add("failed");', hl: ['const auto  add = [&s](const char* word) {'],
                  ex: [['const auto  add = [&s](const char* word) {', 'Lambda bắt ⟦s⟧ theo tham chiếu: hàm phụ cục bộ thêm từ có dấu cách.']] },
              ],
              explain: `Đánh giá chung: tester là C++ hiện đại theo kiểu "giá trị + interface nhỏ + composition", không phải OOP kiểu cây kế thừa. Với một client giao thức, đó là cách đúng.`,
              run: ['⟦runRegressionScenario(client)⟧ tạo ⟦Recorder rec(report)⟧.', 'Mỗi bước: ⟦rec.expectOk("ReadDID F195 version", client.readDid(0xF195), asText)⟧.', '⟦expectOk⟧ thêm ⟦StepResult⟧ (tên, pass, chi tiết) vào báo cáo.', '⟦printReport⟧ in giống tester M5 và trả mã thoát.'],
              fig: { type: 'layers', rows: [['Có (OOP)', ['Abstraction: ITransport', 'Polymorphism: 3 transport', 'Encapsulation: private + method', 'RAII: SimulatedEcu', 'Kế thừa 1 tầng từ interface']], ['Có (pattern)', ['Strategy / DI', 'Adapter (SimulatedEcu)', 'Test double', 'State machine (C)', 'Collecting parameter (Recorder)']], ['Không có', ['Kế thừa đa tầng', 'Factory', 'Singleton thật', 'Observer', 'Visitor']]] },
              video: { t: 'Đánh giá OOP trung thực', d: '2:30', goal: 'Trả lời câu hỏi phỏng vấn về OOP/SOLID.',
                s: ['Năm chữ SOLID, mỗi chữ một ví dụ trong code.', 'Pattern thật: Strategy, Adapter, Test double.', 'Composition thay vì kế thừa.', 'Những gì không có và vì sao không cần.'] },
              pit: [
                ['Gán ghép pattern không có trong code', 'Người phỏng vấn hỏi tiếp "ở đâu?" là lộ. Chỉ nêu pattern bạn chỉ được dòng code.'],
                ['Nghĩ OOP tốt = nhiều kế thừa', 'Kế thừa đa tầng khó đổi; interface nhỏ + composition linh hoạt hơn.'],
              ],
              ex: { task: `Chỉ ra một chỗ trong firmware C cũng áp dụng tư tưởng Strategy dù C không có class.`, sol: `⟦IsoTp_Config_t.sendFrame⟧ / ⟦getTimeMs⟧ (chiến lược gửi và đo thời gian được truyền vào), ⟦Uds_Config_t⟧ với bảng DID và ⟦ecuReset⟧, ⟦DtcMgr_Init⟧ với lock/unlock.` },
              quiz: [
                ['Pattern nào mô tả đúng vai trò của SimulatedEcu?', ['Factory', 'Adapter', 'Observer', 'Visitor'], 1, 'Chuyển API C thành ITransport.'],
                ['Tester có dùng kế thừa đa tầng không?', ['Có, nhiều tầng', 'Không, mọi quan hệ kế thừa chỉ một tầng', 'Chỉ trong test', 'Không dùng kế thừa nào'], 1, 'SimulatedEcu và ScriptedTransport kế thừa trực tiếp ITransport; fixture test kế thừa trực tiếp ::testing::Test.'],
              ],
              sum: ['Kế thừa 1 tầng từ interface; composition là chính.', 'SOLID đều có ví dụ cụ thể.', 'Pattern thật: Strategy/DI, Adapter, Test double, State machine.', 'Nói rõ những gì không có.'],
            },
          ],
        },
      ],
    },
  ],
};
